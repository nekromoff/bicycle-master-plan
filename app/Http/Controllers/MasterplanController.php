<?php

namespace App\Http\Controllers;

use App\Cycleway;
use App\Layer;
use App\Marker;
use App\Relation;
use Illuminate\Http\Request;

class MasterplanController extends Controller
{
    public function map(Request $request)
    {
        $layers = Layer::get()->keyBy('id');
        $markers = Marker::with('relations')->get();
        $cycleways = Cycleway::get()->keyBy('id');
        return view('masterplan', ['layers' => $layers, 'markers' => $markers, 'cycleways' => $cycleways]);
    }
}
