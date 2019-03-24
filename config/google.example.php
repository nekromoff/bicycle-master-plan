<?php

return [

    'APPLICATION_NAME'   => '', // name of your app
    'CLIENT_ID'          => '', // client ID
    'KEY_FILE'           => '', // .json file in public/ directory
    'SPREADSHEETS_SCOPE' => 'https://www.googleapis.com/auth/spreadsheets',
    'EIA_FILE'           => '', // ID of file
    'EIA_SHEET'          => '', // Name of sheet to extract data from
    'SHEET_STRUCTURE'    => ['name' => 0, 'coords' => 1, 'description' => 2, 'cycleways' => 3], // sheet columns to extract data from, 0 = column A

];
