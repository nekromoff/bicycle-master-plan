# Bicycle Master Plan
Bicycle Master Plan is a tool / web app for displaying various bicycle infrastructure related data on a map. Actually, you can use any OpenStreetMap / custom data on a map, not just bicycle-related data. Extensive visual customization is possible by automatical conversion of OSM keys and values to CSS classes.

It supports the following sources of data:
- OSM data (JSON format; tiles, paths/ways and markers)
- database data (seed your database; markers)
- GPS EXIF-tagged photos (automatic using default seeder; markers)
- custom feed data (from any public URL/API in JSON format; markers)
- custom data (from rows in Google Sheets; markers only)
- data provided by users via form (if editable layer enabled; markers)

Features on the map:
- layers with legends, clustering and CSS styling generated from OSM tags
- street cross-sections drawn from OSM tags when hovering a path
- *optional* A to B navigation for bicycles over the map's paths, with turn by turn directions and share links (see [Navigation](#navigation-a-to-b))
- interface in several languages, switchable on the map without reloading (see [Languages and translations](#languages-and-translations))

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
8. symlink `public/storage/` (TARGET) to `storage/app/public/uploads/` (SOURCE), if an editable layer is enabled (see https://laravel.com/docs/7.x/filesystem#the-public-disk)

## Configuration
1. Edit `config/map.php`
    - Set basic info such as map name, language, bounding box, center and zoom
        - `language` = the language the map opens in (two letter code, a file in `public/translations/`)
        - `intro` = the help text shown on first visit and by the help button; one text, or one per language, e.g. `['sk' => '<h1>...</h1>', 'en' => '<h1>...</h1>']`
        - *optional* `translations` = the map's own texts (layer names, legends, type names) in other languages, see [Languages and translations](#languages-and-translations)
    - Configure `layers`:
        - a base layer (usually a background map tile layer) is always `0` in config file
        - `type` = `path`, `marker`, `combined`
        - `name` = name of a layer (can contain HTML tags)
        - `class` = CSS class to be used to mark up layer items (markers / paths)
        - `icon` = layer item icon (markers only) will be created from either `name` or `filename` in database
        - *optional* `file` = OSM JSON file containing layer content (markers or paths/ways downloaded from OSM)
        - *optional* `cluster` = `true` for layers to group/cluster items/markers
        - *optional* `min_zoom` = zoom level from which the layer's items are drawn, e.g. `16` for bicycle parking; also on one of its `types`, which wins over the layer's. Zoomed out further, the layer stays switched on in the layers control and in shared links, greyed with a "Zoom in to see" hint. Its data is downloaded only once the map is zoomed in that far, and only once: zooming out and in again reuses what was loaded.
        - *optional* `editable` = `true` for the user editable layer (user submitted items require admin approval, see below)
        - *optional* `types` = *array* a layer can contain multiple types of items such as different sets of markers etc.
    - *optional* Configure OSM data/layers to download:
        - `osm_server` = *array* of Overpass API servers, tried in order when one times out or fails, e.g. `['https://lz4.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']`
        - `osm_data` = *array* of map layers with `file` parameter:
            - `file` = filename to save the file
            - `data` = overpass query to download OSM data, e.g. `[out:json]; (relation[network=lcn]({{bbox}}); ); out body; >; out skel qt;`, see https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_API_by_Example
    - *optional* Configure `navigation` to enable A to B navigation, see [Navigation](#navigation-a-to-b)
    - *optional* Configure admin emails (see below on how to enable admin functionality):
        - `admins` = *array* of admin emails, e.g. ['someone@example.com', 'other@example.com']
2. *optional* If you enable an editable layer, user submitted items require admin approval to be displayed. Set `approved` column to `1` in database. If user marked an item as `outdated` (`1` in database), set `deleted` to `1` in database to hide it from a map.
3. *optional* If you want to display bikeshare data on your map, see file `config/bikeshare.example.php` for details on how to enable data download (public bikeshare API endpoint required)
4. *optional* If you want to display additional custom data/markers on your map from **Google Sheets**, see `config/google.example.php` file on how to configure it (you will need to create a project with service access with `client_id` and JSON `keyfile` at https://console.developers.google.com)
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

Open `public/css/main.css` to customize layer markers or styles of paths etc. SVG properties (`fill`, `stroke` etc.) need to be used for styling paths/OSM ways, see https://css-tricks.com/svg-properties-and-css/.

Example of path classes created from OpenStreetMap data (bicycle lane):
```
class="path cycleway-left-lane cycleway-right-shared_lane foot-use_sidepath highway-residential lit-yes maxspeed-30 name-dunajska name-hu-dunautca surface-asphalt trolley_wire-yes"
```

Example of marker classes created from OpenStreetMap data (bicycle parking):
```
class="marker access-private amenity-bicycle_parking covered-yes surveillance-yes parking"
```

Any combinations of keys / values can be easily styled for your purposes by using standardized CSS.

City specific styles go to the stylesheet set by `stylesheet` in `config/map.php` (e.g. `public/css/cities/your-city.css`). Navigation has its own `public/css/navigation.css`, loaded only when navigation is enabled.

## Languages and translations
The interface texts live in `public/translations/<code>.js`, one file per language (e.g. `en.js`, `sk.js`). The map opens in `language` from `config/map.php`.

- **Switching language:** when there is more than one translation file, a button next to the help button shows the current language code. Clicking it lists the available languages, and the choice is applied immediately without reloading: buttons, tooltips, menus, the open sidebar and the navigation. The choice is remembered in the visitor's browser.
- **Adding a language:** copy `public/translations/en.js` to `public/translations/<code>.js` and translate the values. The language appears in the language menu automatically. Keep the keys the same in every file.
- **The map's own texts:** layer names, legends and type names are written in `config/map.php` in the map's language, so they are translated in the config, keyed by the text exactly as the config writes it. Only the words between the markup are translated, so swatches, images and line breaks stay. A text without a translation stays as it is.
```
'translations' => [
    'en' => [
        'Existujúce cyklotrasy' => 'Existing cycle routes',
        'Oddelené' => 'Segregated',
        'V premávke' => 'In traffic',
    ],
],
```
- **The intro:** give one text per language, e.g. `'intro' => ['sk' => '<h1>...</h1>', 'en' => '<h1>...</h1>']`. A single text is shown in every language.

What a way is called (e.g. *Pedestrian zone*, *Segregated bike lane*, *Pedestrian crossing*) is decided in one place, `public/js/waynames.js`, and shared by the sidebar, the street cross-section and the navigation's directions, so they always use the same words.

## Navigation (A to B)
*Optional.* Routes a bicycle from A to B over the paths of one path layer, helped by ordinary roads and footpaths where the layer has none. The map runs as before when navigation is not configured.

### Enabling
Add a `navigation` block to `config/map.php`. `config/map.example.php` contains a complete, commented setup that can be uncommented and adjusted. In short:
1. A path layer to route over, e.g. layer `5` with `'file' => 'ways.json'`. `navigation.layer` is its id.
2. *optional, recommended* Ordinary roads and footpaths between the paths: an `osm_data` entry with `'file' => 'roads.json'` (the Overpass query is in the example config) and `'support' => 'roads.json'` in `navigation`. These roads are only used for routing, never drawn. With them, set `gap_distance` to about `20`; without them, about `60`.
3. Run `/refresh/osm` (see [Automatic data update](#automatic-data-update)) so that the files are downloaded.

### Using it
- Click the navigation button (top left) and click the map twice for A and B, or right-click the map and choose *Navigate from here*; the next right-click sets B.
- Existing markers can be clicked to be used as A or B.
- Drag A or B to change the route; it is recalculated while dragging.
- The panel shows the length and time, how much of the route is on segregated cycle routes, in traffic and on footways, and turn by turn directions. Clicking a step zooms to it.
- The route is kept in the address bar (`n=` parameter), so copying the address or using the share button shares the route.

### Turn by turn with a voice
Once a route is shown, *Start navigation* follows the rider along it from the phone's position (the browser asks for permission on the tap). The panel gives way to a bar with the next manoeuvre and the distance to it, the map keeps the rider in view, and every manoeuvre is chimed and spoken through the browser's own voice in the map's language: a chime with a lower note means a left turn, a higher note a right turn, one note a slight turn and two a full one, and a rising three note chime the arrival. A rider who leaves the route gets a new one from where they are. The screen is kept on where the browser allows it; the page has to stay in front, phones stop a page in the background.

`public/js/guidance.js` does the geometry - where on the route the rider is, and what to say when - without the map, so it is tested in Node: `npm test`.

A route can be tried without riding it: `/navigation/demo` takes a shared link and plays a fake position along the route at a chosen speed, logs every announcement, and can send the rider off the route. The map itself does the same with `sim=1` (or another speed multiplier) added to a shared link, e.g. `#n=…&sim=4`.

### How the route is found
Everything runs in the visitor's browser (`public/js/navigation.js`); the server only serves the data. The router has no Leaflet dependency, so `buildGraph()` and `route()` can be run and tested in Node.

1. **Loading.** When navigation is first switched on, the navigation layer's paths (`/data/layer/{id}`, the same cached file the map uses) and, with `support`, the compact roads file (`/data/navigation`) are downloaded. The roads file stores every point once and lets ways refer to it by index, and leaves out ways the layer already contains.
2. **Building the graph** (`buildGraph()`, once per page):
    - Every OSM point becomes a vertex. Points are identified by their coordinates rounded to 7 decimals, so a junction shared by a layer path and a road is one vertex and connects them.
    - Every piece of a way between two points becomes an edge with its length and cost (length × factor, see [How a way is scored](#how-a-way-is-scored)). Impassable ways are left out. One-way ways get an edge in their allowed direction only ([Direction of travel](#direction-of-travel)).
    - Coordinates are projected to metres around the map's first point, and edges and vertices are put in a grid of `cell` × `cell` metres, so nearby things are found without scanning the whole network.
    - **Gaps** are bridged: connected parts of the network are found with a union-find, and nearby disconnected parts and dead ends get straight links costing length × `gap_factor` ([Gaps](#gaps-and-clicked-points)).
3. **Joining A and B to the network** (`snap()`): the nearest edge within `snap_distance` is found in the grid, together with every other edge up to 30 m further (at most 8). A and B become two temporary vertices linked to the point on each of those edges, at a cost of the distance × `gap_factor`. Several candidates matter: when the nearest edge is a one-way street or a cut-off stretch, the route simply joins at the next one.
4. **Searching** (`route()`): **A\*** (a Dijkstra search guided towards B) with a binary heap. The estimate of the remaining cost is the straight-line distance to B × the lowest factor in the network. It never overestimates, so the route found is the cheapest one, not just a good one, while far fewer vertices are explored than by plain Dijkstra. When B cannot be reached, *No route found* is shown.
5. **Describing the route:**
    - Each stretch is classified for the map colour (blue / orange), the three summary lines and the legend category of the steps ([How a route is shown](#how-a-route-is-shown)); length and time (`speed`, or `walking_speed` on walked ways) are summed.
    - **Turn by turn steps**: consecutive stretches of the same street, or of the same kind of way where it has no name, become one step. Pieces under 15 m (gaps under 30 m) are folded into the step before, except crossings, steps and roundabouts; a crossing between two pieces of the same way disappears into it; straight-on steps differing only in the kind of way are merged. The turn is measured from the direction of travel 20 m before and 20 m after the junction: under 25° straight, under 60° slight, otherwise left or right. A roundabout counts its exits.
6. **Recalculating.** Dragging A or B searches again in the already built graph, at most every 100 ms while moving and at least every 300 ms, so the route follows the pointer. The route is written to the address bar as a compact code of both points (relative to the map's `bounding_box`), which is read back when the link is opened.

### Configuration reference
Every key is optional; missing keys take the defaults in `public/js/navigation.js` (`DEFAULTS`). Rules are evaluated in the visitor's browser, so after changing them only reload the map (run `php artisan config:clear` if the config is cached). `/refresh/osm` is needed only when the downloaded data or the `support` file changes.

| Key | Default | Meaning |
|---|---|---|
| `layer` | `5` | id of the path layer to route over |
| `speed` | `13` | riding speed in km/h, for the time estimate |
| `walking_speed` | `4` | speed in km/h on ways marked `walk` |
| `respect_oneway` | `true` | follow one-way streets (see [Direction](#direction-of-travel)) |
| `snap_distance` | `250` | how many metres from the nearest way a clicked point may be; further away, "too far from the paths" is shown |
| `support` | none | `osm_data` file with ordinary roads and footpaths, e.g. `'roads.json'` |
| `gap_distance` | `60` | unconnected ways closer than this (metres) are linked by a straight line; about `20` with `support`, about `60` without |
| `gap_factor` | `4` | cost factor of such a link, and of getting from a clicked point to the nearest way |
| `no_gaps` | bridges | ways that may only be linked at their first and last point (see [Gaps](#gaps-and-clicked-points)) |
| `default_factor` | `1.5` | factor of a way that no rule matches |
| `legend` | see example | which entry of the layer's legend (its swatch class) marks each kind of route stretch in the directions |
| `rules`, `modifiers` | see example | score the ways of the navigation layer |
| `support_rules`, `support_modifiers` | see example | score the roads and footpaths from `support` |
| `cell` | `50` | spatial index cell size in metres, no need to change |

### How a way is scored
Every way gets a **cost per metre**, and the route with the lowest total cost wins.

1. The rules are tried **from top to bottom**. The **first rule whose `match` holds** sets the `factor` (and `walk` / `infrastructure`). Later rules are not looked at. When no rule matches, `default_factor` is used.
2. Then **every** modifier whose `match` holds multiplies the factor. Modifiers do not stop at the first match, so several can apply.
3. A way is left out of the network (**impassable**) when the rule's factor is `false`, or when any matching modifier has `factor => false`.
4. Cost of the way = its length × the final factor.

What the factor means: `1` is ideal. A factor of `2` makes a way count twice its length, so the route will take a detour of up to twice the length to avoid it. Factors below `1` are allowed but make the route prefer such ways even over a shorter, ideal one.

**Worked example.** A 200 m residential road with `surface=gravel`, scored by the support rules: the first matching rule is `highway=residential` → factor `2`; the surface modifier matches → `2 × 1.5 = 3`; cost `200 × 3 = 600`. A 450 m cycle path (`highway=cycleway`, factor `1`) costs `450`, so the route takes the longer cycle path.

A rule or modifier:
```
['match' => ['highway' => ['footway', 'path'], 'bicycle' => false], 'factor' => 1.7, 'walk' => true, 'infrastructure' => false]
```
- `match` - the conditions, **all** of which must hold. `[]` (empty) always matches, which makes a catch-all last rule.
- `factor` - a number greater than `0`, or `false` for impassable.
- `walk` - `true` counts the way at `walking_speed` (steps, dismount zones, footways where cycling is not allowed). A modifier with `walk => true` makes the way walked as well.
- `infrastructure` - `true` counts the way as cycling infrastructure (rules only).

### Match conditions
Each key of `match` is an OSM tag of the way, or a `side:` channel. Values:

| Written as | Holds when | Example |
|---|---|---|
| `'value'` | the tag has exactly this value | `'highway' => 'cycleway'` |
| `['a', 'b']` | the tag has any of these values | `'surface' => ['gravel', 'dirt']` |
| `true` | the tag is present, whatever its value | `'lcn' => true` |
| `false` | the tag is **absent** | `'bicycle' => false` (no bicycle tag at all) |

- Values are compared as **text**: write `'maxspeed' => ['60', '70']`, not numbers. A value like `50 mph` or `RO:urban` matches only if listed exactly.
- `false` in `match` (tag absent) is not the same as `'factor' => false` (impassable).
- **Order matters.** Put impassable rules first, specific rules before general ones, and the catch-all `['match' => [], ...]` last. For example, `highway=cycleway` has to come before `bicycle=dismount`, or cycle paths tagged `bicycle=dismount` would be walked.

**Side channels** (`side:form`, `side:direction`, `side:separation`, ...) match the cycling infrastructure the server resolves for each side of a street from its `cycleway*` tags (`app/Services/CyclewayNormalizer.php`). A side condition holds when **either side** of the street (or the path itself) has one of the values. The values are:

| Channel | Values |
|---|---|
| `side:form` | `lane`, `track`, `shared_lane`, `share_busway`, `shoulder`, `sidepath`, `asl`, `crossing` on streets; `track` (a `highway=cycleway`) or `tolerated` (a footway, path or pedestrian zone with `bicycle=yes/designated/official`) on standalone paths. Old values are normalized: `opposite_lane` and `opposite` → `lane`, `opposite_track` → `track`, `shared_busway` → `share_busway`, `yes` → `lane` |
| `side:direction` | `forward`, `backward`, `two_way` (relative to the way's direction) |
| `side:separation` | `kerb`, `buffer`, `paint` (`none` never matches) |
| `side:lane` | the `cycleway:*:lane` value, e.g. `advisory`, `exclusive` |
| `side:transit` | `bus`, `tram` (on `share_busway`) |
| `side:surface`, `side:width` | the cycleway's own `surface` / `width` |

**Which tags a rule can see**
- Ways of the navigation layer: all their OSM tags, plus side channels.
- Roads and footpaths from `support`: **only** these tags are kept (`app/Services/NavigationSupport.php`): `highway`, `name`, `ref`, `service`, `oneway`, `oneway:bicycle`, `junction`, `access`, `vehicle`, `bicycle`, `foot`, `footway`, `segregated`, `motor_vehicle`, `motorcar`, `motorroad`, `surface`, `maxspeed`, `bridge`, `tunnel`, `railway`, `embedded_rails`, and every key starting with `lanes`, `sidewalk`, `parking` or `cycleway`. A support rule on any other tag never matches. **Side channels are not resolved for support roads**, so `side:` conditions never match in `support_rules` - match the `cycleway*` tags directly there.
- Ways the navigation layer already contains are left out of `support`, so every way is scored once, by `rules`.

**Recommended structure of `support_rules`** (as in `config/map.example.php`):
1. what a bicycle may not use at all: motorways and trunk roads, `motorroad=yes`, `bicycle=no|use_sidepath|private`, `access`/`vehicle` `private|no` without a `bicycle` tag, fast arterials (`maxspeed` 60 and more, or `foot=no`);
2. what is walked: `bicycle=dismount`, steps, footways without cycling allowed;
3. roads closed to motor vehicles (`motor_vehicle=no`), as cheap as a footway that allows cycling; they are shown and counted as separated cycle routes;
4. ordinary roads, cheapest to dearest: `living_street`, `residential`, `service`/`unclassified`/`track`, `tertiary`, `secondary`, `primary`;
5. a catch-all.

Road factors should stay above the factors of the layer's cycle infrastructure, otherwise the route leaves the cycle paths for roads.

### Direction of travel
With `respect_oneway` a way is ridden only in its allowed direction:
- `oneway=yes|1|true` - forward only; `oneway=-1|reverse` - backward only; `junction=roundabout` without `oneway` counts as `oneway=yes`;
- `oneway:bicycle=no` - both directions, whatever else is tagged; `oneway:bicycle=yes` - forward only;
- a side channel with `direction` `backward` or `two_way` (a contraflow lane) opens that direction again.

### Gaps and clicked points
- **Gaps.** OSM ways often end a few metres from each other. After the network is built, each point is linked by a straight line to the nearest point of every *other disconnected part* of the network within `gap_distance`, and a dead end is also linked to the nearest point of another way close by. A link costs its length × `gap_factor`, is drawn dashed and counted as *In traffic*. Only the nearest point of each part is linked, so a parallel path does not get a ladder of links.
- **`no_gaps`** uses the same `match` syntax. A matching way (by default bridges) accepts links only at its first and last point, so a route cannot jump between a bridge and the street below it.
- **Clicked points** join the network at the nearest way within `snap_distance`, and also at other ways up to 30 m further (up to 8 of them), so a click between two parallel ways can use either. Getting from the click to the way costs the distance × `gap_factor`.

### How a route is shown
- The route on the map is **blue** on segregated cycle routes and footways, **orange** in traffic (roads without cycle infrastructure, tram lines and gaps).
- The panel sums the route up in three lines: *Segregated cycle routes* (including paths for mountain bikes), *In traffic*, *Usable (footways)*.
- Each turn by turn step has a bar in the colour of the layer's legend entry it mostly is, picked by `legend`:
    - `separated` - cycle paths and crossings, cycle tracks
    - `traffic` - cycling in traffic on a way of the layer: advisory lanes, lanes on 50 km/h streets without a track, shared and bus lanes
    - `recommended` - `lcn=provisional|proposed`
    - `footway` - footways and walked ways
    - `mtb` - `mtb:scale`, unpaved cycle paths, tracks with cycling allowed
    - Ways with nothing for cycling get an orange bar.
- Consecutive straight-on steps on the same street that differ only in the kind of way are merged into one, e.g. **Mlynská** (*Road*, *Bike lane*). The names are the same ones the sidebar and the cross-section use (`public/js/waynames.js`).

### Tips
- To avoid a way completely, use `'factor' => false`. To avoid it only when there is a reasonable alternative, use a high factor such as `5`.
- To check a rule, open the way on the map: the sidebar lists all its tags, which is what `match` compares against.
- To see how rules change a route, reload the map after editing the config and drag A or B; the route is recalculated while dragging.

The graph is built in the browser. With roads and footpaths for a whole city the roads file is large (Bratislava: about 13 MB, 3 MB compressed), so the first route takes a few seconds on slower phones.

## Automatic data update
The refresh URLs are protected: set a random secret as `MAP_REFRESH_TOKEN` in `.env` and pass it as `?token=`; a logged in administrator can open them without it. Then setup cron to call them daily (or other interval), e.g.:
```
15 0 * * * /usr/bin/curl --silent "https://example.com/public/refresh/osm?token=YOUR_SECRET" >/dev/null 2>&1
```
Update endpoints are:
- OSM data: `/refresh/osm` (also rebuilds the compact roads file for navigation, served at `/data/navigation`)
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
// OSM data to fetch
'osm_server'     => ['https://lz4.overpass-api.de/api/interpreter'],
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

### Bicycle parking stands from OpenStreetMap
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
'osm_server'     => ['https://lz4.overpass-api.de/api/interpreter'],
'osm_data'       => [
    [
        'file' => 'parking.json',
        'data' => '[out:json]; (node[amenity="bicycle_parking"]({{bbox}}); node["amenity"="bicycle_repair_station"]({{bbox}}); ); out body; >; out skel qt;',
    ],
],
```
