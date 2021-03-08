<?php

return [
    'GTM_ID'             => '', // google tag manager ID
    'APPLICATION_NAME'   => '', // name of your app
    'CLIENT_ID'          => '', // client ID
    'KEY_FILE'           => '', // .json file in public/ directory
    'SPREADSHEETS_SCOPE' => 'https://www.googleapis.com/auth/spreadsheets',
    'SPREADSHEET_FILE'   => '', // ID of file
    'SPREADSHEET_SHEET'  => '', // Name of sheet to extract data from
    'SHEET_STRUCTURE'    => ['name' => 0, 'coords' => 1, 'description' => 2, 'cycleways' => 3, 'url' => 4], // sheet columns to extract data from, 0 = column A; description could be an array, if multiple values should be extracted
    'MAP_DETAILS'        => ['layer_id' => 9, 'type' => 1], // layer id and type to save fetched data under
];
