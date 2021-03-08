<?php

return [

    'bikeshares' => [
        // multiple bike shares supported
        'bikeshare_name' => [
            'layer_id'      => 5, // layer id to use (must match layer in config/map.php)
            'type'          => 1, // type to use (must match layer/type in config/map.php)
            'url'           => '', // URL with JSON bikeshare stands (markers) or array of multiple URLs
            'name'          => '', // field name in JSON that contains marker "name"
            'coords'        => ['lat', 'lon'], // marker "coords" = string with lat,lon comma separated field or array of separate lat, lon fields containing coordinates (dot notation for multidimensional arrays, e.g. points.0.lat or 0.stand.0)
            'description'   => '', // field name in JSON that contains marker "description"
            'filename'      => '', // field name in JSON that contains marker "filename" (e.g. photo)
            'bicycle_count' => '', // field name in JSON that contains number of bicycles at stand (will be added to description)
        ],
    ],

];
