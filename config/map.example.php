<?php

return [

    // Website/map name
    'name'           => 'Your city bicycle master plan map',
    // Map language (two letter ISO code) - matches JSON file in public/translations/ directory
    'language'       => 'en',
    // The map's own texts (layer names with their legend, type names) in other languages, keyed by the
    // text exactly as this config writes it. Only the words between the markup are translated, so
    // swatches, images and line breaks stay. A text left out stays as it is.
    'translations'   => [
        'sk' => [
            'Bicycle related' => 'Cyklistické',
            'Roadsigns'       => 'Značky',
            'Photos'          => 'Fotky',
        ],
    ],
    // stylesheet to use for city specific rendering, path from public/
    'stylesheet'     => 'css/cities/your-city.css',
    // Favicon + social network image for sharing (min. 200x200 px recommended)
    'image'          => 'image.png',
    // intro informational popup: one text, or one per language, e.g. ['en' => '<h1>...</h1>', 'sk' => '<h1>...</h1>']
    'intro'          => '<h1>Your city bicycle map</h1><p>You can use this map to find your way around by bicycle. And more info can be put here.</p>',
    // Bounding box for fetching data from Overpass API
    'bounding_box'   => '48.086565298417796,16.9573974609375,48.253026757626124,17.238235473632812',
    // Map center
    'center'         => [48.1468, 17.1235],
    // Map zoom
    'zoom'           => 15,
    // Layers to be displayed by default (array) / must match layers below
    'default_layers' => ['base', '1/1'],
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
            'type'              => 'marker',
            'name'              => 'Developments',
            'class'             => 'development',
            'editable'          => true,
            'allowed_filetypes' => [ // allowed MIME filetypes for upload
                'image/jpg'       => 'filename', // what db column is used for storing filename: filename (for images), url (for PDFs and such)
                'image/jpeg'      => 'filename',
                'image/png'       => 'filename',
                'application/pdf' => 'url',
            ],
            'editable_types'    => [
                1 => [
                    'name'  => 'Warning',
                    'class' => 'warning',
                ],
                2 => [
                    'name'  => 'Information',
                    'class' => 'info',
                ],
            ],
        ],
        // only one layer can be editable! (first layer found with editable=true will be used)
        3 => [
            'type'  => 'marker',
            'name'  => 'Bikesharing stations',
            // optional: drawn only from this zoom level on, on a layer or on one of its types (the type's wins);
            // zoomed out, the layer stays switched on and in links, and its data is loaded once zoomed in
            'min_zoom' => 14,
            'class' => 'bikeshare',
        ],
    ],
    /*
        // OPTIONAL: A TO B NAVIGATION (public/js/navigation.js, public/css/navigation.css)
        //
        // Switched off while 'navigation' is missing, the map runs fine without it. To switch it on,
        // uncomment the parts below and set them for your city. Every key inside 'navigation' is
        // optional, navigation.js has the same defaults.

        // 1. A path layer to route over, added to 'layers' above. navigation.layer is its id. The layer
        //    draws an osm_data file, and its name holds the legend whose swatch classes navigation.legend refers to:

        5 => [
            'type' => 'path',
            'name' => 'Cycle routes<br><span class="cycleway-lane">━━━</span> Segregated<br><span class="cycleway-shared_lane">━━━</span> In traffic<br><span class="lcn-provisional">• • • •</span> Recommended (unsigned)<br><span class="highway-pedestrian">━━━</span> Usable (footways)<br><span class="mtb-scale">━━━</span> Mountain bike',
            'file' => 'ways.json',
        ],

        // 2. The OSM data, fetched from Overpass into storage/app/osm/ when the OSM data is refreshed.
        //    The layer's file, plus roads.json with ordinary roads and footpaths for navigation only.
        //    roads.json is never drawn, and navigation.support is ignored until it has been fetched:

        'osm_server' => [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
        ],
        'osm_data' => [
            [
                'file' => 'ways.json',
                'data' => '[out:json]; (way[cycleway]({{bbox}}); way["cycleway:left"]({{bbox}}); way["cycleway:right"]({{bbox}}); way["cycleway:both"]({{bbox}}); way[highway=pedestrian]({{bbox}}); way[highway=cycleway]({{bbox}}); way[bicycle=yes]({{bbox}}); way[bicycle=designated]({{bbox}}); way[lcn]({{bbox}}); ); out body; >; out skel qt;',
            ],
            [
                'file' => 'roads.json',
                'data' => '[out:json][timeout:300]; (way[highway~"^(residential|living_street|service|unclassified|tertiary|tertiary_link|secondary|secondary_link|primary|primary_link|track|road)$"][area!=yes][access!~"^(private|no)$"][bicycle!=no][service!~"^(driveway|parking_aisle|drive-through)$"]({{bbox}}); way[highway~"^(footway|path|pedestrian|steps|bridleway|cycleway)$"][area!=yes][access!~"^(private|no)$"][bicycle!=no]({{bbox}}); ); out body; >; out skel qt;',
            ],
        ],

        // Full reference of every key and of how rules match: README.md, section "Navigation (A to B)".
        //
        // 3. The navigation itself. Every way gets a cost per metre. The first matching rule sets the
        //    factor, then every matching modifier multiplies it. 1 is ideal, higher is avoided more,
        //    and false makes the way impassable. walk => true counts the way at walking_speed.
        //    infrastructure => true counts it as cycling infrastructure.
        //    Match values: 'value' equals, ['a', 'b'] is any of, true means the tag is present,
        //    false means it is absent. side:form, side:direction and side:separation match the cycling
        //    channels resolved per side of the street (lane, track, shared_lane, ...). All conditions
        //    of one match must hold, and an empty match always matches. rules and modifiers score the
        //    layer's paths, support_rules and support_modifiers score the roads from roads.json.

        'navigation' => [
            'layer' => 5,
            // km/h
            'speed' => 13,
            'walking_speed' => 4,
            'respect_oneway' => true,
            // metres a clicked point may be away from the nearest path
            'snap_distance' => 250,
            // leave out to route over the layer alone, and raise gap_distance to ~60 then
            'support' => 'roads.json',
            // unconnected paths closer than this (metres) are linked; the link costs gap_factor per metre
            'gap_distance' => 20,
            'gap_factor' => 4,
            // the swatch class in the layer's legend that each kind of route stretch is shown and counted as
            'legend' => [
                'separated' => 'cycleway-lane',
                'traffic' => 'cycleway-shared_lane',
                'recommended' => 'lcn-provisional',
                'footway' => 'highway-pedestrian',
                'mtb' => 'mtb-scale',
            ],
            // ways a gap may only link to at their first and last point, so a route cannot jump from a bridge to the street under it
            'no_gaps' => [
                ['match' => ['bridge' => ['yes', 'viaduct', 'boardwalk', 'cantilever', 'covered', 'movable', 'trestle', 'suspension', 'aqueduct']]],
            ],
            'rules' => [
                ['match' => ['highway' => ['construction', 'proposed']], 'factor' => false],
                ['match' => ['highway' => 'steps'], 'factor' => 5, 'walk' => true],
                ['match' => ['highway' => 'cycleway'], 'factor' => 1, 'infrastructure' => true],
                // after the cycleway rule on purpose: a drawn cycle path is ridden whatever bicycle=dismount says
                ['match' => ['bicycle' => 'dismount'], 'factor' => 3.5, 'walk' => true],
                ['match' => ['bicycle' => 'designated'], 'factor' => 1, 'infrastructure' => true],
                ['match' => ['side:form' => ['track', 'lane', 'opposite_lane', 'opposite_track', 'sidepath']], 'factor' => 1.1, 'infrastructure' => true],
                ['match' => ['railway' => 'tram'], 'factor' => 1.6],
                ['match' => ['side:form' => ['shared_lane', 'share_busway', 'shared_busway', 'opposite', 'shoulder']], 'factor' => 1.3],
                ['match' => ['lcn' => true], 'factor' => 1.3],
                // pedestrian only, no bicycle tag at all
                ['match' => ['highway' => ['pedestrian', 'footway', 'path'], 'bicycle' => false], 'factor' => 1.7],
                ['match' => ['highway' => ['pedestrian', 'footway', 'path']], 'factor' => 1.5],
                ['match' => [], 'factor' => 1.5],
            ],
            'modifiers' => [
                ['match' => ['surface' => ['unpaved', 'ground', 'dirt', 'earth', 'grass', 'mud', 'sand', 'gravel', 'fine_gravel', 'compacted', 'pebblestone', 'woodchips']], 'factor' => 1.5],
                ['match' => ['mtb:scale' => true], 'factor' => 1.5],
            ],
            // the supporting roads: riding in traffic, so dearer than any path
            'support_rules' => [
                ['match' => ['highway' => ['motorway', 'motorway_link', 'trunk', 'trunk_link']], 'factor' => false],
                ['match' => ['motorroad' => 'yes'], 'factor' => false],
                // cycling not allowed, or a parallel cycle path is compulsory
                ['match' => ['bicycle' => ['no', 'use_sidepath', 'private']], 'factor' => false],
                // closed in general, unless the road says bicycles may use it anyway
                ['match' => ['access' => ['private', 'no'], 'bicycle' => false], 'factor' => false],
                ['match' => ['vehicle' => ['no', 'private'], 'bicycle' => false], 'factor' => false],
                // fast arterials: no place for a bicycle even without a sign
                ['match' => ['highway' => ['primary', 'primary_link', 'secondary', 'secondary_link'], 'maxspeed' => ['60', '70', '80', '90', '100', '110', '120', '130']], 'factor' => false],
                ['match' => ['highway' => ['primary', 'primary_link', 'secondary', 'secondary_link'], 'foot' => 'no'], 'factor' => false],
                ['match' => ['highway' => ['primary', 'primary_link'], 'foot' => 'use_sidepath', 'maxspeed' => false], 'factor' => false],
                ['match' => ['bicycle' => 'dismount'], 'factor' => 3.5, 'walk' => true],
                // footpaths, mostly to reach a destination off the street: walked unless cycling is allowed
                ['match' => ['highway' => 'steps'], 'factor' => 5, 'walk' => true],
                ['match' => ['highway' => 'cycleway'], 'factor' => 1, 'infrastructure' => true],
                ['match' => ['highway' => ['footway', 'pedestrian', 'path', 'bridleway'], 'bicycle' => ['yes', 'designated', 'permissive']], 'factor' => 1.5],
                ['match' => ['highway' => 'path'], 'factor' => 2],
                ['match' => ['highway' => ['footway', 'pedestrian', 'bridleway']], 'factor' => 3.5, 'walk' => true],
                // a road closed to motor vehicles: no traffic, ridden like a footway that allows cycling
                ['match' => ['motor_vehicle' => 'no'], 'factor' => 1.5],
                ['match' => ['highway' => 'living_street'], 'factor' => 1.5],
                ['match' => ['highway' => 'residential'], 'factor' => 2],
                ['match' => ['highway' => ['service', 'unclassified', 'track', 'road']], 'factor' => 2.5],
                ['match' => ['highway' => ['tertiary', 'tertiary_link']], 'factor' => 2.5],
                ['match' => ['highway' => ['secondary', 'secondary_link']], 'factor' => 3.5],
                ['match' => ['highway' => ['primary', 'primary_link']], 'factor' => 5],
                ['match' => [], 'factor' => 3],
            ],
            'support_modifiers' => [
                ['match' => ['maxspeed' => ['60', '70', '80', '90']], 'factor' => 1.5],
                ['match' => ['surface' => ['unpaved', 'ground', 'dirt', 'earth', 'grass', 'mud', 'sand', 'gravel', 'fine_gravel', 'compacted', 'pebblestone', 'woodchips']], 'factor' => 1.5],
            ],
        ],
    */
    // map administrators - array of emails (login via oauth2 / google)
    'admins'         => ['somebody@example.com'],
    // the /refresh/* routes need ?token= matching this (MAP_REFRESH_TOKEN in .env), or a logged in admin
    'refresh_token'  => env('MAP_REFRESH_TOKEN'),

];
