<?php

namespace App\Http\Controllers;

use App\Cycleway;
use App\Layer;
use App\Marker;
use App\Relation;
use Illuminate\Http\Request;
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
            $data = '[out:json]; (way[cycleway](' . $bounding_box . '); way["cycleway:left"](' . $bounding_box . '); way["cycleway:right"](' . $bounding_box . '); way[highway=pedestrian](' . $bounding_box . '); way[highway=cycleway](' . $bounding_box . '); way[bicycle=designated](' . $bounding_box . '); ); out body; >; out skel qt;';
            MasterplanController::fetchAndSaveOverpassData($filename, $data);
        }
    }

    private static function fetchAndSaveOverpassData($filename, $data)
    {
        $overpass = 'https://overpass.kumi.systems/api/interpreter?data=' . urlencode($data);
        $content = file_get_contents($overpass);
        Storage::put($filename, $content);
    }
}
