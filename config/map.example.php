<?php

return [

    // Website/map name
    'name'           => 'Your city bicycle master plan map',
    // intro informational popup
    'intro'          => '<h1>Your city bicycle map</h1><p>You can use this map to find your way around by bicycle. And more info can be put here.</p>',
    // Bounding box for fetching data from Overpass API
    'bounding_box'   => '48.086565298417796,16.9573974609375,48.253026757626124,17.238235473632812',
    // Map center
    'center'         => [48.1468, 17.1235],
    // Map zoom
    'zoom'           => 15,
    // Layers to be displayed by default (array) / must match layers below
    'default_layers' => ['base', 'layer1_type1'],
    // Layers
    'layers'         => [
        0 => [ // always base/tile layer
            'type'    => 'base',
            'name'    => 'Base',
            'url'     => '//tile.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png',
            'options' => [
                'attribution' => '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                'maxZoom'     => 20,
            ],
        ],
        1 => [ // = layer id in database
            'type'  => 'marker',
            'name'  => 'Bicycle related',
            'types' => [
                1 => [ // = layer type in database
                    'name'    => 'Roadsigns',
                    'class'   => 'roadsign',
                    'icon'    => 'name', // name or filename to be included in place of icon
                    'cluster' => true, // if clustering is required
                    'options' => [
                        'disableClusteringAtZoom' => 15, // options that are passed to Javascript Leaflet
                    ],
                ],
                2 => [
                    'name'    => 'Photos',
                    'class'   => 'photo',
                    'icon'    => 'filename',
                    'cluster' => true,
                    'options' => [
                        'disableClusteringAtZoom' => 17,
                    ],
                ],
            ],
        ],
        2 => [
            'type'  => 'marker',
            'name'  => 'Developments',
            'class' => 'development',
        ],
        3 => [
            'type'  => 'marker',
            'name'  => 'Bikesharing stations',
            'class' => 'bikeshare',
        ],
    ],

];
