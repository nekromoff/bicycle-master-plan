<?php

namespace App\Http\Controllers;

use App\Cycleway;
use App\Helpers\Helper;
use App\Layer;
use App\Marker;
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
        $layers = Layer::get()->keyBy('id');
        $markers = Marker::with('relations')->get();
        $cycleways = Cycleway::get()->keyBy('id');
        // load map relations
        $filename = 'osm/network.json';
        $content = Storage::get($filename);
        $result = json_decode($content);
        $data = $result->elements;
        $nodes = [];
        $paths = [];
        $relations = [];
        $parents = [];
        // preprocess nodes
        foreach ($data as $item) {
            if ($item->type == 'node') {
                $nodes[$item->id] = ['lat' => $item->lat, 'lon' => $item->lon];
            } elseif ($item->type == 'relation') {
                $relations[$item->id] = $item->tags;
                foreach ($item->members as $member) {
                    $parents[$member->ref] = $item->id;
                }
            }
        }
        $i = 0;
        foreach ($data as $item) {
            if ($item->type == 'way') {
                foreach ($item->nodes as $node) {
                    if (isset($parents[$item->id])) {
                        $relation_id = $parents[$item->id];
                        $paths[$i]['info'] = (array) $relations[$relation_id];
                    }
                    $paths[$i]['nodes'][] = [$nodes[$node]['lat'], $nodes[$node]['lon']];
                }
                $i++;
            }
        }

        // load map way details
        $filename = 'osm/ways.json';
        $content = Storage::get($filename);
        $result = json_decode($content);
        $data = $result->elements;
        // preprocess nodes
        foreach ($data as $item) {
            if ($item->type == 'node') {
                $nodes[$item->id] = ['lat' => $item->lat, 'lon' => $item->lon];
            }
        }
        $i = count($paths);
        foreach ($data as $item) {
            if ($item->type == 'way') {
                $paths[$i]['info'] = (array) $item->tags;
                foreach ($item->nodes as $node) {
                    $paths[$i]['nodes'][] = [$nodes[$node]['lat'], $nodes[$node]['lon']];
                }
                $i++;
            }
        }
        /* unique keys
        array:16 [
        $routes = [];
        foreach ($paths as $path) {
        $routes[] = $path['info']['operator'] ?? null;
        }
        dd($routes);
        0 => "name"
        1 => "network"
        2 => "operator"
        3 => "ref"
        4 => "route"
        5 => "state"
        6 => "type"
        311 => "colour"
        312 => "complete"
        315 => "note"
        1008 => "FIXME"
        5732 => "description"
        10257 => "website"
        19794 => "cycle_network"
        19802 => "mtb:scale"
        19803 => "mtb:scale:imba"
         */
        return view('masterplan', ['layers' => $layers, 'markers' => $markers, 'cycleways' => $cycleways, 'paths' => $paths]);
    }

    public function refreshOSMData(Request $request)
    {
        $bounding_box = config('map.bounding_box');
        $filename = 'osm/network.json';
        if (isset($request->force) or !Storage::exists($filename) or Storage::lastModified($filename) < time() - 86400) {
            //Storage::lastModified($filename) < time() - 86400
            $data = '[out:json]; (relation[network=lcn](' . $bounding_box . '); ); out body; >; out skel qt;';
            MasterplanController::fetchAndSaveOverpassData($filename, $data);
        }
        $filename = 'osm/ways.json';
        if (isset($request->force) or !Storage::exists($filename) or Storage::lastModified($filename) < time() - 86400) {
            $data = '[out:json]; (way[cycleway](' . $bounding_box . '); way["cycleway:left"](' . $bounding_box . '); way["cycleway:right"](' . $bounding_box . '); way[highway=pedestrian](' . $bounding_box . '); way[highway=cycleway](' . $bounding_box . '); way[bicycle=yes](' . $bounding_box . '); way[bicycle=designated](' . $bounding_box . '); ); out body; >; out skel qt;';
            MasterplanController::fetchAndSaveOverpassData($filename, $data);
        }
    }

    private static function fetchAndSaveOverpassData($filename, $data)
    {
        $overpass = 'https://overpass.kumi.systems/api/interpreter?data=' . urlencode($data);
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
                $description = trim($rows[$i][$structure['description']]);
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
}
