<?php

namespace App\Http\Controllers;

use App\Cycleway;
use App\Helpers\Helper;
use App\Layer;
use App\Marker;
use App\Path;
use App\Relation;
use Google_Client;
use Google_Service_Sheets;
use Illuminate\Http\Request;
use Revolution\Google\Sheets\Sheets;
use Storage;

class MasterplanController extends Controller
{

    public function map(Request $request)
    {
        return view('masterplan');
    }

    private function initialize()
    {
        $this->nodes = [];
        $this->paths = [];
        $this->relations = [];
        $this->parents = [];
        $bounding_box = config('map.bounding_box');
    }

    public function pushData(Request $request)
    {
        $this->initialize();
        $this->markers = Marker::with('relations')->where('layer_id', $request->id);
        if (isset($request->type)) {
            $this->markers = $this->markers->where('type', $request->type);
        }
        $this->markers = $this->markers->get();
        $this->paths_db = Path::where('layer_id', $request->id);
        if (isset($request->type)) {
            $this->paths_db = $this->paths_db->where('type', $request->type);
        }
        $this->paths_db = $this->paths_db->get();
        $this->cycleways = Cycleway::get()->keyBy('id');

        $layer = config('map.layers')[$request->id];
        $this->processMapfeatures($layer, $request->id);
        if (isset($this->markers_new)) {
            $this->markers = $this->markers->union(collect($this->markers_new));
        }

        $content['markers'] = $this->markers;
        $content['paths'] = $this->paths;
        $content['cycleways'] = $this->cycleways;

        return response()->json($content);
    }

    public function refreshOSMData(Request $request)
    {
        $bounding_box = config('map.bounding_box');
        $osm_data = config('map.osm_data');
        if (is_array($osm_data)) {
            foreach ($osm_data as $data) {
                $filename = 'osm/' . $data['file'];
                $data = str_replace('{{bbox}}', $bounding_box, $data['data']);
                if (isset($request->force) or !Storage::exists($filename) or Storage::lastModified($filename) < time() - 86400) {
                    MasterplanController::fetchAndSaveOverpassData($filename, $data);
                }
            }
        }
    }

    public function fetchAndSaveOverpassData($filename, $data)
    {
        $overpass = config('map.osm_server') . '?data=' . urlencode($data);
        $content = file_get_contents($overpass);
        Storage::put($filename, $content);
    }

    public function refreshBikeshareData(Request $request)
    {
        $bikeshares = config('bikeshare.bikeshares');
        foreach ($bikeshares as $bikeshare) {
            $url = trim($bikeshare['url']);
            $content = file_get_contents($url);
            $stands = json_decode($content, true);
            foreach ($stands as $stand) {
                $name = trim($stand[$bikeshare['name']]);
                $description = trim($stand[$bikeshare['description']]);
                if (is_array($bikeshare['coords'])) {
                    $lat = trim($stand[$bikeshare['coords'][0]]);
                    $lon = trim($stand[$bikeshare['coords'][1]]);
                } else {
                    $coords = explode(',', $stand[$bikeshare['coords']]);
                    $lat = trim($coords[0]);
                    $lon = trim($coords[1]);
                }
                $filename = trim($stand[$bikeshare['filename']]);
                // not used $bikeshare['bicycle_count']
                $marker = Marker::updateOrCreate(['layer_id' => 3, 'type' => 1, 'lat' => $lat, 'lon' => $lon, 'name' => $name], ['description' => $description, 'filename' => $filename]);
            }
        }
    }

    public function refreshEIAData(Request $request)
    {
        $sheets = self::createGoogleServiceSheets();
        $rows = $sheets->spreadsheet(config('google.EIA_FILE'))->sheet(config('google.EIA_SHEET'))->all();
        $structure = config('google.SHEET_STRUCTURE');
        for ($i = 1; $i < count($rows); $i++) {
            $name = trim($rows[$i][$structure['name']]);
            $coords = trim($rows[$i][$structure['coords']]);
            $coords = explode(',', $coords);
            // skip records without coords
            if (count($coords) > 1 and $coords[0]) {
                $lat = trim($coords[0]);
                $lon = trim($coords[1]);
                if (is_array($structure['description'])) {
                    $description = '';
                    foreach ($structure['description'] as $key => $column) {
                        $temp_desc = trim($rows[$i][$column]);
                        if ($temp_desc) {
                            if (stripos($temp_desc, 'http:') !== false or stripos($temp_desc, 'https:') !== false) {
                                $temp_desc = '<a href="' . $temp_desc . '">' . $temp_desc . '</a>';
                            }
                            $description .= $temp_desc;
                            // add line break, if not last one
                            if ($key < count($structure['description']) - 1) {
                                $description .= '<br>';
                            }
                        }
                    }
                } else {
                    $description = trim($rows[$i][$structure['description']]);
                }
                $cycleways = explode(',', trim($rows[$i][$structure['cycleways']]));
                $marker = Marker::updateOrCreate(['layer_id' => 2, 'type' => 1, 'lat' => $lat, 'lon' => $lon, 'name' => $name], ['description' => $description, 'filename' => '']);
                foreach ($cycleways as $cycleway) {
                    $cycleway = trim($cycleway);
                    // skip records with cycleways not filled (#N/A in Google sheets)
                    if ($cycleway and $cycleway != '#N/A') {
                        $cycleway_record = Cycleway::updateOrCreate(['sign' => $cycleway], ['name' => $cycleway, 'description' => '', 'url' => '']);
                        Relation::updateOrCreate(['marker_id' => $marker->id, 'cycleway_id' => $cycleway_record->id]);
                    }
                }
            }
        }
    }

    public function refreshFeedData(Request $request)
    {
        $sheets = self::createGoogleServiceSheets();
        foreach (config('feed.feeds') as $feed) {
            if ($feed['type'] == 'google_sheet') {
                $layer_id = $feed['layer_id'];
                $rows = $sheets->spreadsheet($feed['url'])->sheet('markers')->all();
                foreach ($rows as $key => $row) {
                    if (!$key) {
                        continue;
                    }
                    $name = $row[$feed['name']];
                    $description = trim($row[$feed['description']]);
                    $filename = trim($row[$feed['filename']]);
                    if (is_array($feed['coords'])) {
                        $lat = trim($row[$feed['coords'][0]]);
                        $lon = trim($row[$feed['coords'][1]]);
                    } else {
                        $coords = explode(',', $feed[$coords]);
                        $lat = trim($coords[0]);
                        $lon = trim($coords[1]);
                    }
                    $marker = Marker::updateOrCreate(['layer_id' => $layer_id, 'type' => 1, 'lat' => $lat, 'lon' => $lon, 'name' => $name], ['description' => $description, 'filename' => $filename]);
                    if (isset($row[$feed['cycleways']])) {
                        $cycleways = explode(',', trim($row[$feed['cycleways']]));
                        foreach ($cycleways as $cycleway) {
                            $cycleway = trim($cycleway);
                            // skip records with cycleways not filled (#N/A in Google sheets)
                            if ($cycleway and $cycleway != '#N/A') {
                                $cycleway_record = Cycleway::updateOrCreate(['sign' => $cycleway], ['name' => $cycleway, 'description' => '', 'url' => '']);
                                Relation::updateOrCreate(['marker_id' => $marker->id, 'cycleway_id' => $cycleway_record->id]);
                            }
                        }
                    }
                }
            }
        }
    }

    private static function createGoogleServiceSheets()
    {
        $client = new Google_Client();
        $client->setApplicationName(config('google.APPLICATION_NAME'));
        $client->setClientId(config('google.CLIENT_ID'));
        $client->setScopes([config('google.SPREADSHEETS_SCOPE')]);
        $client->setAuthConfig(config('google.KEY_FILE'));
        $client->useApplicationDefaultCredentials();
        if ($client->isAccessTokenExpired()) {
            $client->refreshTokenWithAssertion();
        }
        $service_token = $client->getAccessToken();
        $service = new \Google_Service_Sheets($client);
        $sheets = new Sheets();
        $sheets->setService($service);
        return $sheets;
    }

    private function processMapfeatures($layer, $layer_id)
    {
        $i = count($this->paths);
        if ($layer['type'] == 'path' and isset($layer['file'])) {
            $filename = 'osm/' . $layer['file'];
            $content = Storage::get($filename);
            $result = json_decode($content);
            $data = $result->elements;
            // preprocess nodes
            foreach ($data as $item) {
                if ($item->type == 'node') {
                    $this->nodes[$item->id] = ['lat' => $item->lat, 'lon' => $item->lon];
                } elseif ($item->type == 'relation') {
                    $this->relations[$item->id] = $item->tags;
                    foreach ($item->members as $member) {
                        $this->parents[$member->ref] = $item->id;
                    }
                }
            }
            foreach ($data as $item) {
                if ($item->type == 'way') {
                    foreach ($item->nodes as $node) {
                        if (isset($this->parents[$item->id])) {
                            $relation_id = $this->parents[$item->id];
                            $this->paths[$i]['info'] = (array) $this->relations[$relation_id];
                        }
                        $this->paths[$i]['nodes'][] = [$this->nodes[$node]['lat'], $this->nodes[$node]['lon']];
                    }
                    if (isset($item->tags)) {
                        $this->paths[$i]['info'] = (array) $item->tags;
                    }
                    $this->paths[$i]['layer_id'] = $layer_id;
                    $i++;
                }
            }
        } elseif ($layer['type'] == 'path') {
            $temp_paths = $this->paths_db;
            $temp_paths = $temp_paths->where('layer_id', $layer_id);
            foreach ($temp_paths as $path) {
                $this->paths[$i]['layer_id'] = $path->layer_id;
                $this->paths[$i]['info']['name'] = $path->name;
                $this->paths[$i]['info']['description'] = $path->description;
                $this->paths[$i]['info']['class'] = $layer['class'];
                $this->paths[$i]['nodes'][] = [$path->lat_start, $path->lon_start];
                $this->paths[$i]['nodes'][] = [$path->lat_end, $path->lon_end];
                $i++;
            }
        } elseif ($layer['type'] == 'marker' and isset($layer['file'])) {
            $filename = 'osm/' . $layer['file'];
            $content = Storage::get($filename);
            $result = json_decode($content);
            $data = $result->elements;
            foreach ($data as $item) {
                if ($item->type == 'node') {
                    $marker_new_id = 'l' . $layer_id . '-' . $item->id;
                    $this->markers_new[$marker_new_id] = ['lat' => $item->lat, 'lon' => $item->lon, 'name' => '', 'description' => '', 'type' => 999, 'layer_id' => $layer_id];
                    if (isset($item->tags)) {
                        $this->markers_new[$marker_new_id]['info'] = (array) $item->tags;
                    }
                    $this->markers_new[$marker_new_id] = (object) $this->markers_new[$marker_new_id];
                }
            }
        } elseif ($layer['type'] == 'combined') {
            $temp_paths = $this->paths_db;
            $temp_paths = $temp_paths->where('layer_id', $layer_id);
            foreach ($temp_paths as $path) {
                $this->paths[$i]['layer_id'] = $path->layer_id;
                $this->paths[$i]['info']['name'] = $path->name;
                $this->paths[$i]['info']['description'] = $path->description;
                $this->paths[$i]['info']['class'] = $layer['class'];
                $this->paths[$i]['nodes'][] = [$path->lat_start, $path->lon_start];
                $this->paths[$i]['nodes'][] = [$path->lat_end, $path->lon_end];
                $i++;
            }
        }
    }

}
