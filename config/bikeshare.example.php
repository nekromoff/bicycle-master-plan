<?php

return [

    'bikeshares' => [
        // multiple bike shares supported
        'bikeshare_name' => [
            'url'           => '', // URL with JSON bikeshare stands (markers)
            'name'          => '', // field name in JSON that contains marker "name"
            'coords'        => ['lat', 'lon'], // marker "coords" = string with lat,lon comma separated field or array of separate lat, lon fields containing coordinates
            'description'   => '', // field name in JSON that contains marker "description"
            'filename'      => '', // field name in JSON that contains marker "filename" (e.g. photo)
            'bicycle_count' => '', // field name in JSON that contains number of bicycles at stand (will be added to description)
        ],
    ],

];
