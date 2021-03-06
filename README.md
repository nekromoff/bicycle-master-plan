# Bicycle Master Plan
Bicycle Master Plan is a tool / web app for displaying various bicycle infrastructure related data on a map. Actually, you can use any OpenStreetMap / custom data on a map, not just bicycle-related data. Extensive visual customization is possible by automatical conversion of OSM keys and values to CSS classes.

It supports the following sources of data:
- OSM data (JSON format; tiles, paths/ways and markers)
- database data (seed your database; markers)
- GPS EXIF-tagged photos (automatic using default seeder; markers)
- custom feed data (from any public URL/API in JSON format; markers)
- custom data (from rows in Google Sheets; markers only)
- data provided by users via form (if editable layer enabled; markers)

Built with:
- Laravel (PHP)
- Leaflet (JS)

## Demo / working version for the city of Bratislava:
https://mapa.cyklokoalicia.sk/bratislava/public/

## Installation
1. download the code (git clone or ZIP file)
2. run `composer install` to download dependencies
3. run `php artisan migrate` to setup database
4. check/set `public/.htaccess` file permissions, if necessary
5. check/set `storage/app/` permissions, if necessary (755 for writing)
6. create `storage/app/public/uploads/` directory (755), if an editable layer is enabled
7. create `storage/app/osm/` directory (755), if OSM layer download is enabled (see below)
8. symlink `public/storage/` (TARGET) to `storage/app/public/uploads/` (SOURCE), if an editable layer is enabled (see https://laravel.com/docs/7.x/filesystem#the-public-disk)

## Configuration
1. Edit `config/map.php`
    - Set basic info such as map name, language, bounding box, center and zoom
    - Configure `layers`:
        - a base layer (usually a background map tile layer) is always `0` in config file
        - `type` = `path`, `marker`, `combined`
        - `name` = name of a layer (can contain HTML tags)
        - `class` = CSS class to be used to mark up layer items (markers / paths)
        - `icon` = layer item icon (markers only) will be created from either `name` or `filename` in database
        - *optional* `file` = OSM JSON file containing layer content (markers or paths/ways downloaded from OSM)
        - *optional* `cluster` = `true` for layers to group/cluster items/markers
        - *optional* `editable` = `true` for the user editable layer (user submitted items require admin approval, see below)
        - *optional* `types` = *array* a layer can contain multiple types of items such as different sets of markers etc.
    - *optional* Configure OSM data/layers to download:
        - `osm_server` = `https://lz4.overpass-api.de/api/interpreter` (use any OSM server)
        - `osm_data` = *array* of map layers with `file` parameter:
            - `file` = filename to save the file
            - `data` = overpass query to download OSM data, e.g. `[out:json]; (relation[network=lcn]({{bbox}}); ); out body; >; out skel qt;`, see https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example
    - *optional* Configure admin emails (see below on how to enable admin functionality):
        - `admins` = *array* of admin emails, e.g. ['someone@example.com', 'other@example.com']
2. *optional* If you enable an editable layer, user submitted items require admin approval to be displayed. Set `approved` column to `1` in database. If user marked an item as `outdated` (`1` in database), set `deleted` to `1` in database to hide it from a map.
3. *optional* If you want to display bikeshare data on your map, see file `config/bikeshare.example.php` for details on how to enable data download (public bikeshare API endpoint required)
4. *optional* If you want to display additional custom data/markers on your map from **Google Sheets**, see `config/google.example.php` file on how to configure it (you will need to create a project with service access with `client_id` and JSON `keyfile` at https://console.developers.google.com)
5. *optional* If you require admin functionality, you will need to obtain client ID + client secret from OAuth2 credentials at https://console.developers.google.com. Once you have these, edit `config/services.php` and add the following lines:
```
'google'    => [
        'client_id'     => 'your_client_id',
        'client_secret' => 'your_client_secret',
        'redirect'      => 'callback URL', // callback URL for OAuth authentication, e.g. http://example.com/login/google/callback
    ],
```

## Customization / map style
All standard map tiles providers are supported.

Open `public/css/main.css` to customize layer markers or styles of paths etc. SVG properties (`fill`, `stroke` etc.) need to be used for styling paths/OSM ways, see https://css-tricks.com/svg-properties-and-css/.

Example of path classes created from OpenStreetMap data (bicycle lane):
```
class="path cycleway-left-lane cycleway-right-shared_lane foot-use_sidepath highway-residential lit-yes maxspeed-30 name-dunajska name-hu-dunautca surface-asphalt trolley_wire-yes"
```

Example of marker classes created from OpenStreetMap data (bicycle parking):
```
class="marker access-private amenity-bicycle_parking covered-yes surveillance-yes parking"
```

Any combinations of keys / values can be easily styled for your purposes by using standardized CSS.

## Automatic data update
Setup cron to call refresh URLs daily (or other interval), e.g.:
```
15 0 * * * /usr/bin/curl --silent https://example.com/public/refresh/osm >/dev/null 2>&1
```
Update endpoints are:
- OSM data: `/refresh/osm`
- Bikeshare feed data: `/refresh/bikeshare`
- Google sheets data: `/refresh/googlesheet`
- Feed data: `/refresh/feed`

## Examples

### Markers created from photos automatically
1. Upload photos/files to `public/photos` directory (create this directory, if it does not exist)
2. run `php artisan db:seed --class=PhotosSeeder`
3. Seeder will process all photos in the directory and extract their GPS coordinates from EXIF tags and add them to database as markers
4. Enable photo layer by editing `config/map.php` (enabling clustering will help with large number of photos) and adding this code to `layers`:
```
1 => [
    'type'  => 'marker',
    'name'  => 'Your photos',
    'class'   => 'photo',
    'icon'    => 'filename',
    'cluster' => true,
    'options' => [
        'disableClusteringAtZoom' => 17,
    ],
],
```
5. Refresh your map to see your photos

### OpenStreeMap cycling paths and bike sharing stations
1. Edit `config/map.php` and add a layer (change number `5` to suit your purposes) to the `layers`:
```
5 => [
    'type'  => 'path',
    'name'  => 'Cycling paths<br><span class="cycleway-lane">━━━</span> Segregated<br><span class="cycleway-shared_lane">━━━</span> Shared<br><span class="lcn-provisional">• • • •</span> Recommended<br><span class="highway-pedestrian">━━━</span> Pedestrianized<br><span class="mtb-scale">━━━</span> For mountain bikes',
    'class' => 'ways',
    'file'  => 'ways.json',
],
```
2. Add OSM instructions for fetching data in `config/map.php`. Change `network` operator name to your city's one (e.g. `Slovnaft BAjk` for Bratislava):
```
// OSM data to fetch
'osm_server'     => 'https://lz4.overpass-api.de/api/interpreter',
'osm_data'       => [
    [
        'file' => 'ways.json',
        'data' => '[out:json]; (way[cycleway]({{bbox}}); way["cycleway:left"]({{bbox}}); way["cycleway:right"]({{bbox}}); way[highway=pedestrian]({{bbox}}); way[highway=cycleway]({{bbox}}); way[bicycle=yes]({{bbox}}); way[bicycle=official]({{bbox}}); way[lcn]({{bbox}}); way[bicycle=designated]({{bbox}}); ); out body; >; out skel qt;',
    ],
    [
        'file' => 'bikeshare-sb.json',
        'data' => '[out:json]; (node[network="Slovnaft BAjk"]({{bbox}}); ); out body; >; out skel qt;',
    ],
],
```

### Bicycle parking stands from OpenStreeMap
1. Edit `config/map.php` and add a layer (change number `2` to suit your purposes) to the `layers`:
```
2   => [
            'type'  => 'marker',
            'name'  => 'Bicycle parking<br><span class="parking"></span> <span class="parking bicycle_parking-rack"></span> <span class="parking bicycle_parking-shed"></span> Safe<br><span class="parking bicycle_parking-anchors"></span> Unsuitable<br><span class="amenity-bicycle_repair_station"></span> Public pump and tools',
            'class' => 'parking',
            'file'  => 'parking.json',
],
```
2. Add OSM instructions for fetching data in `config/map.php`:
```
'osm_server'     => 'https://lz4.overpass-api.de/api/interpreter',
'osm_data'       => [
    [
        'file' => 'parking.json',
        'data' => '[out:json]; (node[amenity="bicycle_parking"]({{bbox}}); node["amenity"="bicycle_repair_station"]({{bbox}}); ); out body; >; out skel qt;',
    ],
],
```
