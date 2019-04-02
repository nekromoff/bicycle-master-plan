<?php

return [

    'feeds' => [
        // multiple feeds
        'feed_name' => [
            'type'        => 'google_sheet', // type of feed: google_sheet, rss, ...
            'url'         => '', // URL with feed data (markers)
            'name'        => '', // field name in feed that contains marker "name"
            'coords'      => ['lat', 'lon'], // marker "coords" = string with lat,lon comma separated field or array of separate lat, lon fields containing coordinates
            'description' => '', // field name in feed that contains marker "description"
            'filename'    => '', // field name in feed that contains marker "filename" (e.g. photo)
        ],
    ],
];
