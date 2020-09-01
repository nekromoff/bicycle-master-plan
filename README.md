# Bicycle Master Plan
Bicycle Master Plan is a tool / app for displaying various bicycle infrastructure related data on a map. Actually, you can pull any OSM/custom data on a map, not just bicycle-related data.

It supports the following sources of data:
- database data (seed your database; markers only)
- OSM data (JSON format; tiles, paths/ways and markers)
- custom data (rows in Google Sheets; markers only)
- GPS EXIF-tagged photos (automatic using default seeder)

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
        - `class` = CSS class to be used to mark up a layer items (markers / paths)
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
2. *optional* If you enable an editable layer, user submitted items require admin approval to be displayed. Set `approved` column to `1` in database. If user marked an item as `outdated` (`1` in database), set `deleted` to `1` in database to hide it from a map.
3. *optional* If you want bikeshare data on your map, see file `config/bikeshare.example.php` for details on how to enable data download (public bikeshare API endpoint required)
4. *optional* If you want additional custom data/markers on your map from **Google Sheets**, see `config/google.example.php` file on how to configure it (you will need to create a project with service access with `client_id` and JSON `keyfile` at https://console.developers.google.com)

## Customization
Open `public/css/main.css` to customize layer markers or styles of paths etc. SVG properties (`fill`, `stroke` etc.) need to be used for styling paths/OSM ways, see https://css-tricks.com/svg-properties-and-css/.

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