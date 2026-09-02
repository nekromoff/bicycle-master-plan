// if we want to parse paths (buildings) as bicycle parking, we need to make an exception and convert it to markers (nodes)

var core = {};
core.options = {};
core.layers = {};
core.clusters = {};
core.markers = {};
core.paths = {};
core.relations = {};
core.layers_parsed = {};
core.normalized = {};
core.marker_aliases = {};
core.location_marker = false;
core.location_accuracy = false;
core.location_best_accuracy = false;
core.locate_timer = false;
core.tap_layers = {};
core.label_cells = {};
/*
    Route numbers are thinned out on a grid, one tier per zoom range. The cell is in
    degrees, so roughly 11 km, 2 km, 550 m and 220 m apart. Even fully zoomed in the
    labels keep a distance, a route repeats its number on every single segment.
*/
core.label_tiers = [
    {class: 'ref-t1', cell: 0.1, zoom: 12},
    {class: 'ref-t2', cell: 0.05, zoom: 13},
    {class: 'ref-t3', cell: 0.014, zoom: 15},
    {class: 'ref-t4', cell: 0.0035, zoom: 17}
];
// rough width of one character of a route number, used to tell whether it fits on a line
core.label_character_width = 9;
// zoom to use when the visitor asks to be located
core.locate_zoom = 17;
// above this accuracy in metres the reported position is too vague to draw a circle for
core.locate_accuracy_limit = 250;
// accuracy in metres that is precise enough to stop asking for a better fix
core.locate_accuracy_target = 50;
// how long to keep waiting for the device to improve its fix
core.locate_max_wait = 30000;
core.highlighted = null;
core.editable_marker = false;
core.tooltip = null;
core.offsets_collapsed = true;
// below this zoom the two sides of a street are not far enough apart to be worth drawing
core.offset_min_zoom = 15;
// the way the cross-section panel is currently describing
core.crosssection_id = null;
// measured once per drawing, so positioning never forces a layout
core.crosssection_size = null;
core.crosssection_latlng = null;
core.crosssection_frame = null;
// way ids that were joined into a longer path, pointing at the path that replaced them
core.path_aliases = {};

/*
    Small DOM helpers, so that the rest of the file reads the way it did while it was
    still built on jQuery.
*/
function qs(selector, root) {
    return (root || document).querySelector(selector);
}

function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
}

/*
    Replaces a handler of the same type instead of stacking another one on top, which is
    what the .off() before .on() used to take care of.
*/
function bindOnce(element, type, handler) {
    if (element == undefined) {
        return;
    }
    if (element.bound_handlers == undefined) {
        element.bound_handlers = {};
    }
    if (element.bound_handlers[type]) {
        element.removeEventListener(type, element.bound_handlers[type]);
    }
    element.bound_handlers[type] = handler;
    element.addEventListener(type, handler);
}

/*
    AlmostOver measures the exact pixel distance to every layer it knows about on each
    click. A bounding box test first keeps that work off the thousands of paths that are
    nowhere near the tap.
*/
if (window.L != undefined && L.Handler != undefined && L.Handler.AlmostOver != undefined) {
    L.Handler.AlmostOver.include({
        /*
            A side feature is the same way as its centreline, drawn a few pixels to one
            side, and it carries the same path data. Registering both would make every
            pointer move measure the same geometry twice for no different answer, so only
            the centreline takes part in the search.
        */
        addLayer: function(layer) {
            if (typeof layer.eachLayer == 'function') {
                layer.eachLayer(function(child) {
                    this.addLayer(child);
                }, this);
                return;
            }
            if (layer.options != undefined && layer.options.side != undefined) {
                return;
            }
            if (typeof this.indexLayer == 'function') {
                this.indexLayer(layer);
            }
            this._layers.push(layer);
        },

        searchBuffer: function(latlng, buffer) {
            // the buffer is a latitude distance, a degree of longitude is shorter than that
            var longitude_buffer = buffer / Math.max(0.01, Math.cos(latlng.lat * Math.PI / 180));
            var bounds = L.latLngBounds(
                [latlng.lat - buffer, latlng.lng - longitude_buffer],
                [latlng.lat + buffer, latlng.lng + longitude_buffer]
            );
            var found = [];
            for (var i = 0; i < this._layers.length; i++) {
                var layer = this._layers[i];
                if (typeof layer.getBounds == 'function') {
                    if (bounds.intersects(layer.getBounds())) {
                        found.push(layer);
                    }
                } else if (typeof layer.getLatLng == 'function') {
                    if (bounds.contains(layer.getLatLng())) {
                        found.push(layer);
                    }
                } else {
                    found.push(layer);
                }
            }
            return found;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // do form translations
    qsa('#form form label').forEach(function(element) {
        element.textContent = i18n(element.textContent.trim());
    });
    qsa('#form form small').forEach(function(element) {
        element.textContent = i18n(element.textContent.trim());
    });
    qsa('#form form button').forEach(function(element) {
        element.textContent = i18n(element.textContent.trim());
    });
    initSidebarButtons();
    initTooltips();
    changeZoomClass();
    // if location fragment exists on launch
    if (window.location.hash) {
        setupMap();
    } else {
        for (layer_key in core.config.default_layers) {
            if (core.config.default_layers[layer_key] != 'base') {
                fetchLayer(core.config.default_layers[layer_key]);
            }
        }
    }
    map.on('overlayadd', function(e) {
        for (var layer in core.layers) {
            if (core.layers[layer] == e.layer) {
                fetchLayer(getLayerId(layer));
            }
        }
    });
    // panning fires moveend continuously, rewriting the fragment on each one is wasted work
    map.on('moveend', scheduleFragmentRewrite);
    map.on('zoomend', scheduleFragmentRewrite);
    map.on('zoomend', changeZoomClass);
    map.on('overlayremove', function(e) {
        for (var layer in core.layers) {
            if (core.layers[layer] == e.layer) {
                removeTapLayer(layer);
            }
        }
    });
    map.on('almost:click', openNearestObject);
    map.on('almost:over', showTapCursor);
    map.on('almost:out', hideTapCursor);
    map.on('almost:move', trackCrossSection);
    map.on('zoomend', applyPathOffsets);
    map.on('overlayadd', scheduleFragmentRewrite);
    map.on('overlayremove', scheduleFragmentRewrite);
    if (core.editable_layer_id) {
        map.on('contextmenu', createMarker);
    }
    map.on('locationfound', showLocation);
    map.on('locationerror', showLocationError);
});

/*
    The intro is written into the sidebar by the inline script on the page, and the
    sidebar is rewritten on every marker and path that gets opened, so these are matched
    on the way up from the click rather than bound to the elements themselves. That way
    it does not matter whether the markup was there when the page finished loading.
*/
function initSidebarButtons() {
    document.addEventListener('click', function(e) {
        if (e.target == undefined || typeof e.target.closest != 'function') {
            return;
        }
        if (e.target.closest('#intro_off')) {
            setCookie('intro_off', 1, 180);
            closeSidebar();
            return;
        }
        if (e.target.closest('.close')) {
            closeSidebar();
        }
    });
}

/*
    Bootstrap's tooltips were the only thing on the page that still needed jQuery, so
    they are drawn here instead. The markup and the class names are the ones Bootstrap's
    stylesheet already ships, and the listeners sit on the document, so markup added to
    the sidebar later is covered without having to be initialised again.
*/
function initTooltips() {
    document.addEventListener('mouseover', function(e) {
        var trigger = getTooltipTrigger(e.target);
        if (trigger && (core.tooltip == null || core.tooltip.trigger != trigger)) {
            showTooltip(trigger);
        }
    });
    document.addEventListener('mouseout', function(e) {
        var trigger = getTooltipTrigger(e.target);
        if (trigger && core.tooltip != null && core.tooltip.trigger == trigger) {
            hideTooltip();
        }
    });
    // a tap on a touch device would otherwise leave the tooltip standing on the page
    document.addEventListener('click', function(e) {
        if (!getTooltipTrigger(e.target)) {
            hideTooltip();
        }
    });
    window.addEventListener('scroll', hideTooltip, true);
}

function getTooltipTrigger(target) {
    if (target == undefined || typeof target.closest != 'function') {
        return null;
    }
    return target.closest('[data-toggle="tooltip"]');
}

function showTooltip(trigger) {
    hideTooltip();
    // the title is taken off the element, so the browser does not draw its own on top
    var title = trigger.getAttribute('title') || trigger.getAttribute('data-original-title');
    if (!title) {
        return;
    }
    trigger.setAttribute('data-original-title', title);
    trigger.removeAttribute('title');
    var placement = trigger.getAttribute('data-placement') || 'top';
    var tooltip = document.createElement('div');
    tooltip.className = 'tooltip bs-tooltip-' + placement;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.innerHTML = '<div class="arrow"></div><div class="tooltip-inner"></div>';
    qs('.tooltip-inner', tooltip).textContent = title;
    tooltip.style.position = 'absolute';
    tooltip.style.left = '0';
    tooltip.style.top = '0';
    document.body.appendChild(tooltip);
    positionTooltip(tooltip, trigger, placement);
    tooltip.classList.add('show');
    core.tooltip = {
        element: tooltip,
        trigger: trigger
    };
}

function positionTooltip(tooltip, trigger, placement) {
    var rect = trigger.getBoundingClientRect();
    var width = tooltip.offsetWidth;
    var height = tooltip.offsetHeight;
    var scroll_x = window.pageXOffset;
    var scroll_y = window.pageYOffset;
    var left;
    var top;
    if (placement == 'bottom') {
        top = rect.bottom + scroll_y;
        left = rect.left + scroll_x + (rect.width - width) / 2;
    } else if (placement == 'left') {
        top = rect.top + scroll_y + (rect.height - height) / 2;
        left = rect.left + scroll_x - width;
    } else if (placement == 'right') {
        top = rect.top + scroll_y + (rect.height - height) / 2;
        left = rect.right + scroll_x;
    } else {
        top = rect.top + scroll_y - height;
        left = rect.left + scroll_x + (rect.width - width) / 2;
    }
    // a tooltip on something at the edge of the window would otherwise be cut off
    var limit = scroll_x + document.documentElement.clientWidth - width;
    if (left > limit) {
        left = limit;
    }
    if (left < scroll_x) {
        left = scroll_x;
    }
    tooltip.style.left = Math.round(left) + 'px';
    tooltip.style.top = Math.round(top) + 'px';
}

function hideTooltip() {
    if (core.tooltip == null) {
        return;
    }
    var stored = core.tooltip.trigger.getAttribute('data-original-title');
    if (stored) {
        core.tooltip.trigger.setAttribute('title', stored);
        core.tooltip.trigger.removeAttribute('data-original-title');
    }
    if (core.tooltip.element.parentNode) {
        core.tooltip.element.parentNode.removeChild(core.tooltip.element);
    }
    core.tooltip = null;
}

/*
    Reads the location fragment into core.options, without touching the map.

    Current format (openstreetmap.org compatible view):
        #map=15.5/48.14523/17.10761&l=4,5,6&m=456
    Legacy format, still accepted so that shared links keep working:
        #l4,5,6|z15.5|c48.14523,17.10761|m456
*/
function parseFragment() {
    var hash = window.location.hash.trim().replace('#', '');
    if (!hash) {
        return;
    }
    // legacy links use | as separator, some clients percent-encode it
    if (hash.indexOf('|') != -1 || hash.toLowerCase().indexOf('%7c') != -1) {
        parseLegacyFragment(decodeURIComponent(hash));
        return;
    }
    var params = new URLSearchParams(hash);
    if (params.get('map')) {
        var view = params.get('map').split('/');
        if (view.length == 3) {
            setView(view[0], view[1], view[2]);
        }
    }
    if (params.get('l')) {
        core.options.layers_found = params.get('l').split(',');
    }
    if (params.get('m')) {
        core.options.marker_id = params.get('m');
    }
    if (params.get('p')) {
        core.options.path_id = params.get('p');
    }
}

function parseLegacyFragment(hash) {
    hash.split('|').forEach(function(part) {
        part = part.trim();
        if (part.indexOf('l') != -1) {
            core.options.layers_found = part.replace('l', '').split(',');
        }
        if (part.indexOf('z') != -1) {
            core.options.zoom = parseFloat(part.replace('z', ''));
        }
        if (part.indexOf('c') != -1) {
            var center = part.replace('c', '').split(',');
            setView(core.options.zoom, center[0], center[1]);
        }
        // set marker, if linked
        if (part.indexOf('m') != -1 && part.indexOf('p') == -1) {
            core.options.marker_id = part.replace('m', '');
        }
        // set path, if linked
        if (part.indexOf('p') != -1) {
            core.options.path_id = part.replace('p', '');
        }
    });
}

function setView(zoom, lat, lng) {
    zoom = parseFloat(zoom);
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    if (isNaN(lat) || isNaN(lng)) {
        return;
    }
    if (!isNaN(zoom)) {
        core.options.zoom = zoom;
    }
    core.options.center = [lat, lng];
    core.options.center['lat'] = lat;
    core.options.center['lng'] = lng;
}

// called before the map exists, so it may only read options
function forceOptions() {
    parseFragment();
}

function setupMap() {
    parseFragment();
    if (core.options.center != undefined && core.options.center['lat'] != undefined) {
        map.setView([core.options.center['lat'], core.options.center['lng']], core.options.zoom);
    }
    if (core.options.layers_found != undefined) {
        toggleLayers(core.options.layers_found);
    }
    // an old-style link is rewritten to the current format straight away
    rewriteFragment();
}

function toggleLayers(layers_found) {
    for (layer in layers_found) {
        fetchLayer(layers_found[layer]);
    }
}

var fragment_timer;

function scheduleFragmentRewrite() {
    if (fragment_timer) {
        window.clearTimeout(fragment_timer);
    }
    fragment_timer = window.setTimeout(rewriteFragment, 150);
}

function rewriteFragment() {
    core.layers_enabled = [];
    for (var parsed_key in core.layers_parsed) {
        var layer_key = 'layer' + parsed_key;
        if (parsed_key.indexOf('/') != -1) {
            var parts = parsed_key.split('/');
            layer_key = 'layer' + parts[0] + '_type' + parts[1];
        }
        if (map.hasLayer(core.layers[layer_key])) {
            core.layers_enabled.push(parsed_key);
        }
    }
    // layers asked for by the fragment are kept until they finish loading,
    // otherwise the link would lose them while the request is still running
    if (core.options.layers_found != undefined) {
        core.options.layers_found.forEach(function(layer_id) {
            if (!core.layers_parsed[layer_id] && core.layers_enabled.indexOf(layer_id) == -1) {
                core.layers_enabled.push(layer_id);
            }
        });
    }
    core.options.zoom = map.getZoom();
    core.options.center = map.getCenter();
    var fragment = 'map=' + core.options.zoom + '/' + core.options.center['lat'].toFixed(5) + '/' + core.options.center['lng'].toFixed(5);
    if (core.layers_enabled.length) {
        fragment = fragment + '&l=' + core.layers_enabled.join(',');
    }
    if (core.options.path_id) {
        fragment = fragment + '&p=' + core.options.path_id;
    }
    if (core.options.marker_id) {
        fragment = fragment + '&m=' + core.options.marker_id;
    }
    // replaceState, so that panning the map does not fill up the browser history
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#' + fragment);
    } else {
        window.location.hash = fragment;
    }
}

function changeZoomClass() {
    var map_element = qs('#map');
    for (var i = map.getMinZoom(); i <= map.getMaxZoom(); i++) {
        map_element.classList.remove('z' + i);
    }
    var zoom = Math.floor(map.getZoom());
    map_element.classList.add('z' + zoom);
    /*
        A route number is repeated on every segment of the route, so only the tiers that
        are far enough apart for the current zoom are shown.
    */
    map_element.classList.remove('refs-none');
    for (var tier = 0; tier < core.label_tiers.length; tier++) {
        map_element.classList.remove('refs-' + tier);
    }
    var visible_tier = false;
    for (var tier = core.label_tiers.length - 1; tier >= 0; tier--) {
        if (zoom >= core.label_tiers[tier].zoom) {
            visible_tier = tier;
            break;
        }
    }
    map_element.classList.add(visible_tier === false ? 'refs-none' : 'refs-' + visible_tier);
}

/*
    Route numbers come from the route relation, so every segment of a route carries the
    same one, hundreds of times over for the longer routes.

    Each label claims a cell in the widest grid it still fits in, which spreads the
    labels that survive along the whole route rather than dropping entire stretches.
    The longest segments are dealt out first, because the label is drawn along the line
    and is cut short on a line that is shorter than the text.

    @paths object paths as received from the server
    @return object path id -> class name, ids without a label are missing from it
*/
function getLabelClasses(paths) {
    var labelled = [];
    for (var key in paths) {
        var path = paths[key];
        if (path.info == undefined || !path.info.ref || path.nodes == undefined || path.nodes.length < 2) {
            continue;
        }
        labelled.push({
            id: path.id,
            ref: String(path.info.ref),
            lat: path.nodes[0][0],
            lon: path.nodes[0][1],
            length: getPathLength(path.nodes)
        });
    }
    labelled.sort(function(a, b) {
        return b.length - a.length;
    });
    var classes = {};
    for (var i = 0; i < labelled.length; i++) {
        var label_class = getLabelClass(labelled[i]);
        if (label_class) {
            classes[labelled[i].id] = label_class;
        }
    }
    return classes;
}

function getLabelClass(label) {
    for (var tier = 0; tier < core.label_tiers.length; tier++) {
        // a label longer than its own line is cut off, so it is not put there at all
        var needed = label.ref.length * core.label_character_width * getResolution(core.label_tiers[tier].zoom, label.lat);
        if (label.length < needed) {
            continue;
        }
        var cell = core.label_tiers[tier].cell;
        var key = label.ref + '|' + tier + '|' + Math.round(label.lat / cell) + '|' + Math.round(label.lon / cell);
        if (core.label_cells[key] == undefined) {
            core.label_cells[key] = true;
            return core.label_tiers[tier].class;
        }
    }
    return false;
}

// metres per pixel at the given zoom, the map is in the usual web mercator projection
function getResolution(zoom, lat) {
    return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
}

function getPathLength(nodes) {
    var length = 0;
    for (var i = 1; i < nodes.length; i++) {
        var lat_distance = (nodes[i][0] - nodes[i - 1][0]) * 110540;
        var lon_distance = (nodes[i][1] - nodes[i - 1][1]) * 111320 * Math.cos(nodes[i - 1][0] * Math.PI / 180);
        length = length + Math.sqrt(lat_distance * lat_distance + lon_distance * lon_distance);
    }
    return length;
}

function removeObjectFragment() {
    removeHighlight();
    core.options.marker_id = undefined;
    core.options.path_id = undefined;
    rewriteFragment();
}

function getLayerId(layer) {
    layer_id = layer.replace('layer', '')
    if (layer.indexOf('_type') != -1) {
        layer_id = layer_id.replace('_type', '/')
    }
    layer_id = layer_id.trim();
    return layer_id;
}

function fetchLayer(layer_id, type) {
    // if layer_id is entered as layer_id/type combo, separate them
    layer_id = layer_id.toString();
    if (layer_id.indexOf('/') != -1) {
        var parts = layer_id.split('/');
        layer_id = parts[0];
        type = parts[1];
    }
    // already downloaded and parsed, only needs to be put back on the map
    if (core.layers_parsed[getParsedKey(layer_id, type)]) {
        showLayer(layer_id, type);
        return;
    }
    var url = 'data/layer/' + layer_id;
    if (type) {
        url = url + '/' + type;
    }
    fetch(url, {
        headers: {
            'Accept': 'application/json'
        }
    }).then(function(response) {
        return response.json();
    }).then(function(data) {
        parseLayer(data, layer_id, type);
    }).catch(function(error) {
        console.error('Layer ' + layer_id + ' could not be loaded', error);
    });
}

function getParsedKey(layer_id, type) {
    if (type) {
        return layer_id + '/' + type;
    }
    return layer_id;
}

function parseLayer(data, layer_id, type) {
    var parsed_key = getParsedKey(layer_id, type);
    if (!core.layers_parsed[parsed_key]) {
        parsePaths(data, layer_id, type);
        parseMarkers(data, layer_id, type);
        core.layers_parsed[parsed_key] = true;
    }
    showLayer(layer_id, type);
}

function showLayer(layer_id, type) {
    var layer_key = 'layer' + layer_id;
    if (core.config.layers[layer_id].types != undefined && type) {
        layer_key = 'layer' + layer_id + '_type' + type;
    }
    map.addLayer(core.layers[layer_key]);
    addTapLayer(layer_key);
    rewriteFragment();
    core.options.marker_id = resolveMarkerId(core.options.marker_id);
    if (core.options.marker_id != undefined && core.markers[core.options.marker_id] != undefined) {
        highlightMarker();
        openSidebar(getMarkerContent(core.options.marker_id));
        toggleSidebarCheck(core.options.marker_id, 'marker');
    }
    if (core.options.path_id != undefined && core.paths[core.options.path_id] != undefined) {
        highlightPath();
        openSidebar(getPathContent(core.options.path_id));
        toggleSidebarCheck(core.options.path_id, 'path');
    }
}

/*
    A way with cycling infrastructure tagged per side is drawn as one line per side,
    offset from the centreline, instead of a single line centred on the carriageway.
    The offset is in screen pixels, so the gap between the two stays constant as the
    map zooms. Below street zoom the offsets collapse to nothing - two parallel lines
    a few pixels apart read as noise at city scale.
*/
function parsePaths(data, layer_id, type) {
    var label_classes = getLabelClasses(data.paths);
    for (var path_key in data.paths) {
        var path = data.paths[path_key];
        /*
            The tags that moved onto a side feature are stripped from info, so that the
            centreline does not restyle on them. The sidebar and the cross-section still
            want the whole set, and it is cheaper to put it back together here than to
            ship it down the wire twice.
        */
        /*
            The way ids a joined path was built from keep resolving to it, so a link
            shared before the join still opens the street it pointed at.
        */
        if (path.members != undefined) {
            path.members.forEach(function(member_id) {
                core.path_aliases[member_id] = path.id;
            });
        }
        if (path.side_tags != undefined) {
            path.tags = {};
            for (var info_key in path.info) {
                path.tags[info_key] = path.info[info_key];
            }
            for (var moved_key in path.side_tags) {
                path.tags[moved_key] = path.side_tags[moved_key];
            }
        }
        buildPathFeature(path, path.id, null, label_classes, layer_id, type);
        if (path.sides != undefined) {
            path.sides.forEach(function(side) {
                if (side.side == 'centre') {
                    return;
                }
                buildPathFeature(path, path.id + ':' + side.side, side, label_classes, layer_id, type);
            });
        }
    }
}

/*
    @path object the whole way, shared by every feature drawn from it
    @feature_id string id of this feature: the way id, or the way id plus a side
    @side object|null the resolved side channels, or null for the centreline
*/
function buildPathFeature(path, feature_id, side, label_classes, layer_id, type) {
    {
        var classes = 'path';
        var polyline_options = {
            orig_id: feature_id,
            orig_type: 'path',
            // without this a direct hit also reaches the map and opens the path twice
            bubblingMouseEvents: false
        };
        if (side != null) {
            polyline_options.side = side.side;
            polyline_options.side_offset = side.offset;
            polyline_options.offset = core.offsets_collapsed ? 0 : side.offset;
            classes = classes + ' side-' + side.side;
            for (var channel_key in side.channels) {
                if (side.channels[channel_key] != null && side.channels[channel_key] !== false) {
                    classes = classes + ' ' + normalize(channel_key) + '-' + normalize(side.channels[channel_key], /[^A-Za-z0-9_-]/g);
                }
            }
        }
        if (side == null && hasSides(path)) {
            // the infrastructure is drawn as its own offset line, so the centreline
            // must not also colour itself in on the tags that produced it
            classes = classes + ' has-sides';
        }
        if (path.info != undefined) {
            // define relation, if ref exists
            if (path.info.ref != undefined) {
                var relation = normalize('ref-' + path.info.ref, /[^A-Za-z0-9_-]/g);
                polyline_options.relation = relation;
                createRelation(relation, path.id);
            } else {
                var relation = normalize('simulated-' + path.id, /[^A-Za-z0-9_-]/g);
                polyline_options.relation = relation;
                createRelation(relation, path.id);
                classes = classes + ' ' + relation;
            }
            for (var detail_key in path.info) {
                classes = classes + ' ' + normalize(detail_key) + '-' + normalize(path.info[detail_key], /[^A-Za-z0-9_-]/g)
            }
        }
        polyline_options.className = classes;
        polyline_options.path_data = path;
        var feature = L.polyline([path.nodes], polyline_options);
        core.paths[feature_id] = feature;
        if (side != null) {
            /*
                Only the directions worth remarking on get a glyph. Riding with the
                traffic is what the street already says, so an arrow for it adds nothing
                and costs a repeated text run on every one of these features - which is
                most of them.
            */
            var direction_glyph = {backward: '←', two_way: '↔'};
            if (direction_glyph[side.channels.direction] != undefined) {
                feature.setText(direction_glyph[side.channels.direction], {
                    repeat: 6,
                    offset: 6
                });
            }
        } else if (path.info != undefined) {
            // Arrow follows the line direction on its own (Safari ignores the SVG rotate attribute, so no rotation hack here)
            if (path.info.oneway != undefined && path.info.oneway == 'yes' && path.info['oneway:bicycle'] == undefined && path.info.highway != 'cycleway' && path.info.bicycle == undefined && !hasSides(path)) {
                feature.setText('→', {
                    repeat: 10,
                    offset: 6
                });
            }
            // Bridge sign for bridges (following the line direction, parallel)
            // Hack to ignore paths where duplicate separate cycleway path exists
            if (path.info.bridge != undefined && (path.info.bridge == 'yes' || path.info.bridge == 'viaduct') && path.info.cycleway != 'separate') {
                feature.setText('⎴', {
                    repeat: 5,
                    offset: 3
                });
            }
            // Slope sign for key incline where specified in %
            if (path.info.incline != undefined && path.info.incline != 'up' && path.info.incline != 'down' && path.info.incline != '0%' && path.info.incline != '0') {
                feature.setText('◤', {
                    repeat: 5,
                    offset: 3,
                    attributes: {
                        'font-size': '40%'
                    }
                });
            }
            if (label_classes[path.id] != undefined) {
                feature.setText(path.info.ref, {
                    attributes: {
                        class: label_classes[path.id]
                    }
                });
            }
        }
        feature.on('click', function() {
            openPath(this.options.orig_id);
        });
        // add to layer
        if (core.config.layers[layer_id].types != undefined && type) {
            feature.addTo(core.layers['layer' + layer_id + '_type' + type]);
        } else {
            feature.addTo(core.layers['layer' + layer_id]);
        }
    }
}

// does this way carry cycling infrastructure drawn as its own offset line?
function hasSides(path) {
    if (path.sides == undefined) {
        return false;
    }
    for (var i = 0; i < path.sides.length; i++) {
        if (path.sides[i].side != 'centre') {
            return true;
        }
    }
    return false;
}

/*
    Offsets are a street-scale device. Kept at city zoom they only double the number
    of visible lines, so they are collapsed until the map is zoomed in far enough for
    the two sides of a street to be worth telling apart.
*/
function applyPathOffsets() {
    var collapsed = map.getZoom() < core.offset_min_zoom;
    if (collapsed === core.offsets_collapsed) {
        return;
    }
    core.offsets_collapsed = collapsed;
    for (var path_id in core.paths) {
        var feature = core.paths[path_id];
        if (feature.options.side == undefined || typeof feature.setOffset != 'function') {
            continue;
        }
        var offset = collapsed ? 0 : feature.options.side_offset;
        if (feature._map) {
            feature.setOffset(offset);
        } else {
            feature.options.offset = offset;
        }
    }
}

/*
    Same as for markers: only the path that gets opened needs its sidebar markup.
*/
/*
    A way drawn per side has one feature id per side, and a link may have been shared
    before it was split, or may point at a side that is no longer tagged. Both fall back
    to the centreline, which is always drawn.
*/
function resolvePathId(path_id) {
    if (path_id == undefined || core.paths[path_id] != undefined) {
        return path_id;
    }
    var centre = String(path_id).split(':')[0];
    if (core.paths[centre] != undefined) {
        return centre;
    }
    if (core.path_aliases[centre] != undefined) {
        return core.path_aliases[centre];
    }
    return path_id;
}

function getPathContent(path_id) {
    var path_layer = core.paths[resolvePathId(path_id)];
    if (path_layer == undefined) {
        return '';
    }
    if (path_layer.options.content == undefined) {
        path_layer.options.content = buildPathContent(path_layer.options.path_data);
    }
    return path_layer.options.content;
}

function buildPathContent(path) {
    var content = '';
    // the same drawing the hover panel shows, so the two never disagree
    if (typeof crossSection != 'undefined') {
        if (path.crosssection == undefined) {
            path.crosssection = crossSection.render(path);
        }
        if (path.crosssection) {
            content = content + '<div class="crosssection-sidebar">' + path.crosssection + '</div>';
        }
    }
    /*
        The cycleway tags are moved out of info and onto the side features, so that the
        centreline does not restyle on them. The description below still wants the whole
        tag set, and reads it from the copy the server keeps.
    */
    if (path.tags != undefined) {
        path = {id: path.id, nodes: path.nodes, sides: path.sides, tags: path.tags, info: path.tags};
    }
    if (path.info != undefined) {
        if (path.info.name != undefined && path.info.name) {
            content = content + '<h2>';
        }
        if (path.info.name != undefined && path.info.name) {
            content = content + path.info.name;
        }
        if (path.info.name != undefined && path.info.name) {
            content = content + '<button class="btn btn-lg btn-link float-right share" data-toggle="tooltip" data-placement="bottom" title="' + i18n('Copy link to clipboard') + '">🔗</button>';
            content = content + '</h2>';
        }
        if (path.info.name == undefined) {
            content = content + '<strong>';
        }
        if (path.info.lcn != undefined && path.info.lcn == 'provisional') {
            content = content + i18n('Recommended path for cyclists') + '<br>';
        }
        if (path.info.bridge != undefined && (path.info.bridge == 'yes' || path.info.bridge == 'viaduct')) {
            content = content + i18n('Bridge') + '<br>';
        }
        /*
            A crossing is named for who may use it, so it is decided once in
            crosssection.js and printed here, rather than falling through to the rules
            for the path types it is tagged on.
        */
        var is_crossing = typeof crossSection != 'undefined' && crossSection.isCrossing(path.info);
        if (is_crossing) {
            content = content + i18n('Marking') + ': ' + crossSection.crossingLabel(path.info) + '<br>';
        }
        if (!is_crossing && path.info.highway != undefined && path.info.highway == 'cycleway') {
            content = content + i18n('Marking') + ': ' + i18n('Segregated bike lane') + '<br>';
        }
        if (path.info.railway != undefined && path.info.railway == 'tram' && path.info.bicycle != undefined && path.info.bicycle) {
            content = content + i18n('Marking') + ': ' + i18n('Tram & bicycle access') + '<br>';
        }
        // highway=pedestrian is a pedestrian zone, whether or not cycling is allowed in it
        if (!is_crossing && path.info.highway != undefined && path.info.highway == 'pedestrian') {
            content = content + i18n('Marking') + ': ' + i18n('Pedestrian zone') + '<br>';
        }
        if (!is_crossing && path.info.highway != undefined && path.info.highway != 'pedestrian' && path.info.cycleway == undefined && (path.info.highway == 'footway' || path.info.highway == 'path') && path.info.bicycle != undefined && path.info.bicycle) {
            if ((path.info.motorcar != undefined && path.info.motorcar == 'no') || (path.info['motor_vehicle'] != undefined && path.info['motor_vehicle'] == 'no') && path.info.bicycle == 'yes') {
                content = content + i18n('Marking') + ': ' + i18n('No motor vehicles') + '<br>';
            } else if (path.info.bicycle == 'yes' || path.info.bicycle == 'designated') {
                content = content + i18n('Marking') + ': ' + i18n('Shared-use path') + '<br>';
            }
        }
        if (!is_crossing && path.info['cycleway:lane'] != undefined && path.info['cycleway:lane']) {
            content = content + i18n('Marking') + ': ';
            content = content + describeBicycleInfrastructure(path.info['cycleway:lane']) + '<br>';
        } else if (!is_crossing && path.info.cycleway != undefined && path.info.cycleway != 'separate') {
            content = content + i18n('Marking') + ': ';
            content = content + describeBicycleInfrastructure(path.info.cycleway) + '<br>';
        }
        if (path.info['cycleway:right:lane'] != undefined && path.info['cycleway:right:lane']) {
            content = content + i18n('Marking') + ': ';
            content = content + describeBicycleInfrastructure(path.info['cycleway:right:lane']);
            content = content + ' (' + i18n('Right side') + ') ' + '<br>';
        } else if (path.info['cycleway:right'] != undefined && path.info['cycleway:right']) {
            content = content + i18n('Marking') + ': ';
            content = content + describeBicycleInfrastructure(path.info['cycleway:right']);
            content = content + ' (' + i18n('Right side') + ') ' + '<br>';
        }
        if (path.info['cycleway:left:lane'] != undefined && path.info['cycleway:left:lane']) {
            content = content + i18n('Marking') + ': ';
            content = content + describeBicycleInfrastructure(path.info['cycleway:left:lane']);
            content = content + ' (' + i18n('Left side') + ') ' + '<br>';
        } else if (path.info['cycleway:left'] != undefined && path.info['cycleway:left']) {
            content = content + i18n('Marking') + ': ';
            content = content + describeBicycleInfrastructure(path.info['cycleway:left']);
            content = content + ' (' + i18n('Left side') + ') ' + '<br>';
        }
        // include incline only where incline specified in %
        if (path.info.incline != undefined && path.info.incline != 'up' && path.info.incline != 'down' && path.info.incline != '0%' && path.info.incline != '0') {
            content = content + i18n('Incline') + ': ' + i18n(path.info.incline) + '<br>';
        }
        if (path.info.name == undefined) {
            content = content + '</strong>';
        }
        if (path.info.ref != undefined && path.info.ref) {
            content = content + i18n('Path number') + ': ' + path.info.ref + '<br>';
        }
        if (path.info.operator != undefined && path.info.operator) {
            content = content + i18n('Operator') + ': ' + path.info.operator + '<br>';
        }
        if (path.info.state != undefined && path.info.state) {
            content = content + i18n('State') + ': ' + i18n(path.info.state) + '<br>';
        }
        if (Object.keys(path.info).length) {
            content = content + '<hr class="my-2"><p class="text-secondary mt-0">';
        }
        for (detail_key in path.info) {
            content = content + detail_key + '=' + path.info[detail_key] + '<br>';
        }
        if (Object.keys(path.info).length) {
            content = content + '</p>';
        }
    }
    return content;
}

function parseMarkers(data, layer_id, type) {
    for (var marker_key in data.markers) {
        var marker = data.markers[marker_key];
        var marker_content = '<div class="marker ';
        if (core.config.layers[layer_id].class) {
            marker_content = marker_content + normalize(core.config.layers[layer_id].class) + ' '
        }
        marker_content = marker_content + normalize(marker.name) + ' ';
        if (marker.info != undefined) {
            for (var info_key in marker.info) {
                // keep numbers for "ref" key content
                marker_content = marker_content + normalize(info_key) + '-' + normalize(marker.info[info_key], /[^A-Za-z0-9_-]/g) + ' ';
            }
        }
        if (marker.description != undefined && marker.description) {
            marker_content = marker_content + 'description-' + normalize(marker.description) + ' ';
        }
        var marker_style = core.config.layers[layer_id];
        if (marker_style.types != undefined && type != undefined && marker_style.types[type] != undefined) {
            marker_style = marker_style.types[type];
        }
        marker_content = marker_content + normalize(marker_style.class) + '">';
        if (marker_style.icon == 'name' && marker.name) {
            marker_content = marker_content + marker.name;
        } else if (marker_style.icon == 'filename' && marker.filename) {
            marker_content = marker_content + '<img src="' + getFilename(layer_id, marker.filename) + '" alt="' + (marker.name ? marker.name : '') + '" class="img-fluid">';
        }
        marker_content = marker_content + '</div>';
        // resolved here, so that the sidebar builder does not have to keep the whole payload
        var signs = [];
        if (marker.relations != undefined && marker.relations.length) {
            for (var relation_key = 0; relation_key < marker.relations.length; relation_key++) {
                var cycleway = data.cycleways != undefined ? data.cycleways[marker.relations[relation_key].cycleway_id] : undefined;
                if (cycleway != undefined && cycleway.sign) {
                    signs.push(cycleway.sign);
                }
            }
        }
        core.markers[marker.id] = L.marker([marker.lat, marker.lon], {
            icon: new L.DivIcon({
                html: marker_content
            }),
            orig_id: marker.id,
            orig_type: 'marker',
            orig_name: marker.name,
            orig_editable_type: marker.type,
            marker_data: marker,
            layer_id: layer_id,
            signs: signs
        });
        /*
            An updated marker is saved as a new row with a new id, so links pointing at
            the marker it replaced have to end up here. Every historical id is registered,
            saveData() re-points the whole history to the newest marker, so one hop is enough.
        */
        if (marker.marker_relations != undefined) {
            for (var relation_index = 0; relation_index < marker.marker_relations.length; relation_index++) {
                var child = marker.marker_relations[relation_index].child;
                if (child != undefined && child.id != undefined) {
                    core.marker_aliases[child.id] = marker.id;
                }
            }
        }
        core.markers[marker.id].on('click', function() {
            openMarker(this.options.orig_id);
        });
        // add to layer
        if (core.config.layers[layer_id].types != undefined && type) {
            core.markers[marker.id].addTo(core.layers['layer' + layer_id + '_type' + type]);
        } else {
            core.markers[marker.id].addTo(core.layers['layer' + layer_id]);
        }
    }
}

function openMarker(marker_id) {
    var content = getMarkerContent(marker_id);
    if (!content) {
        return;
    }
    openSidebar(content);
    toggleSidebarCheck(marker_id, 'marker');
    highlightMarker();
}

function openPath(path_id) {
    var content = getPathContent(path_id);
    if (!content) {
        return;
    }
    openSidebar(content);
    toggleSidebarCheck(path_id, 'path');
}

/*
    The pointer is shown as soon as a click would land on something, not only when the
    cursor is exactly over the line, so that the cursor matches what the click does.
*/
function showTapCursor(e) {
    L.DomUtil.addClass(map.getContainer(), 'almost-over');
    trackCrossSection(e);
}

// almost:move keeps firing as the pointer travels along a line, so the panel follows it
function trackCrossSection(e) {
    if (e == undefined || e.layer == undefined || e.layer.options == undefined) {
        return;
    }
    if (e.layer.options.orig_type != 'path') {
        return;
    }
    showCrossSection(e.layer.options.path_data, e.latlng);
}

function hideTapCursor() {
    L.DomUtil.removeClass(map.getContainer(), 'almost-over');
    hideCrossSection();
}

/*
    The cross-section follows the pointer, so that the drawing and the line it describes
    are read in one glance. It is redrawn only when the way under the pointer changes;
    moving along the same street just repositions it.
*/
function showCrossSection(path, latlng) {
    if (path == undefined || typeof crossSection == 'undefined') {
        return;
    }
    var panel = qs('#crosssection');
    if (panel == null) {
        panel = document.createElement('div');
        panel.id = 'crosssection';
        map.getContainer().appendChild(panel);
    }
    core.crosssection_latlng = latlng;
    if (core.crosssection_id != path.id) {
        // most streets share a handful of profiles, so the drawing is worth keeping
        if (path.crosssection == undefined) {
            path.crosssection = crossSection.render(path);
        }
        if (!path.crosssection) {
            hideCrossSection();
            return;
        }
        core.crosssection_id = path.id;
        core.crosssection_size = null;
        panel.innerHTML = '<div class="crosssection-name">' + escapeHtml(crossSection.title(path)) + '</div>' + path.crosssection;
        panel.classList.add('show');
    }
    /*
        almost:move fires for every pointer sample. Coalescing the moves into one write
        per frame keeps the panel following the cursor without asking the browser to
        reposition it more often than it can draw.
    */
    if (core.crosssection_frame == null) {
        core.crosssection_frame = window.requestAnimationFrame(function() {
            core.crosssection_frame = null;
            positionCrossSection(panel, core.crosssection_latlng);
        });
    }
}

/*
    Sits down and to the right of the pointer, and flips to the other side when there is
    not enough room left - the same rule a tooltip follows, so it never leaves the map or
    covers the stretch of street the pointer is on.
*/
function positionCrossSection(panel, latlng) {
    if (latlng == undefined) {
        return;
    }
    var point = map.latLngToContainerPoint(latlng);
    var container = map.getContainer();
    var gap = 18;
    /*
        Reading offsetWidth forces the browser to lay the page out there and then. This
        runs on every pointer move along a line, so the size is measured once per drawing
        instead - it only changes when the panel's content does.
    */
    if (core.crosssection_size == null) {
        core.crosssection_size = {width: panel.offsetWidth, height: panel.offsetHeight};
    }
    var width = core.crosssection_size.width;
    var height = core.crosssection_size.height;
    var left = point.x + gap;
    var top = point.y + gap;
    if (left + width > container.clientWidth - 8) {
        left = point.x - gap - width;
    }
    if (top + height > container.clientHeight - 8) {
        top = point.y - gap - height;
    }
    panel.style.left = Math.max(8, left) + 'px';
    panel.style.top = Math.max(8, top) + 'px';
}

function hideCrossSection() {
    var panel = qs('#crosssection');
    core.crosssection_id = null;
    if (core.crosssection_frame != null) {
        window.cancelAnimationFrame(core.crosssection_frame);
        core.crosssection_frame = null;
    }
    if (panel != null) {
        panel.classList.remove('show');
    }
}

function escapeHtml(text) {
    var element = document.createElement('div');
    element.textContent = text;
    return element.innerHTML;
}

// a tap that landed near an object rather than on it
function openNearestObject(e) {
    if (e.layer == undefined || e.layer.options == undefined) {
        return;
    }
    hideTapCursor();
    if (e.layer.options.orig_type == 'path') {
        openPath(e.layer.options.orig_id);
    } else if (e.layer.options.orig_type == 'marker') {
        openMarker(e.layer.options.orig_id);
    }
}

/*
    Only what is currently shown takes part in the search, so that hidden layers
    cannot be tapped and the search stays as small as possible.
*/
function addTapLayer(layer_key) {
    if (map.almostOver == undefined || !map.almostOver.enabled() || core.tap_layers[layer_key]) {
        return;
    }
    map.almostOver.addLayer(core.layers[layer_key]);
    core.tap_layers[layer_key] = true;
}

function removeTapLayer(layer_key) {
    if (map.almostOver == undefined || !core.tap_layers[layer_key]) {
        return;
    }
    map.almostOver.removeLayer(core.layers[layer_key]);
    core.tap_layers[layer_key] = false;
}

/*
    Links are shared with the marker id they were created with, but that id is replaced
    every time somebody updates the marker. A link to a marker that has been replaced
    resolves to the marker that replaced it, and the fragment is rewritten to the new id.
*/
function resolveMarkerId(marker_id) {
    if (marker_id == undefined || core.markers[marker_id] != undefined) {
        return marker_id;
    }
    if (core.marker_aliases[marker_id] != undefined) {
        return core.marker_aliases[marker_id];
    }
    return marker_id;
}

/*
    The sidebar of a single marker is what gets read, so its markup is built on first
    open and kept from then on, instead of building it for every marker on the layer.
*/
function getMarkerContent(marker_id) {
    var marker_layer = core.markers[marker_id];
    if (marker_layer == undefined) {
        return '';
    }
    if (marker_layer.options.content == undefined) {
        marker_layer.options.content = buildMarkerContent(marker_layer.options.marker_data, marker_layer.options.layer_id, marker_layer.options.signs);
    }
    return marker_layer.options.content;
}

function getDateFormatter() {
    if (core.date_formatter == undefined) {
        core.date_formatter = new Intl.DateTimeFormat(core.config.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    return core.date_formatter;
}

/*
    @marker object marker as received from the server
    @signs array path signs of the cycleways this marker belongs to
*/
function buildMarkerContent(marker, layer_id, signs) {
    var content = '';
    var has_name = (marker.name != undefined && marker.name) || (marker.info != undefined && marker.info.name != undefined && marker.info.name);
    var has_description = (marker.description != undefined && marker.description) || (marker.info != undefined && marker.info.description != undefined && marker.info.description);
    if (has_name) {
        content = content + '<h2>';
    }
    if (marker.name != undefined && marker.name) {
        content = content + marker.name;
    } else if (marker.info != undefined && marker.info.name) {
        content = content + marker.info.name;
    }
    if (has_name) {
        content = content + '<button class="btn btn-lg btn-link float-right share" data-toggle="tooltip" data-placement="bottom" title="' + i18n('Copy link to clipboard') + '">🔗</button></h2>';
    }
    if (marker.url != undefined && marker.url) {
        content = content + '<a href="' + marker.url + '">' + i18n('Link') + '</a><br>';
    }
    if (has_description) {
        content = content + '<p>';
    }
    if (marker.description != undefined && marker.description) {
        content = content + marker.description;
    } else if (marker.info != undefined && marker.info.description) {
        content = content + marker.info.description;
    }
    if (has_description) {
        content = content + '</p>';
    }
    if (layer_id == core.editable_layer_id && marker.date_reported != undefined) {
        content = content + '<p><strong>' + i18n('Reported on') + ':</strong> ' + getDateFormatter().format(new Date(marker.date_reported)) + '</p>';
        if (marker.outdated == 0) {
            content = content + '<div id="update-help"><p class="form-text text-muted">' + i18n('Provide more info') + '</p><button type="button" class="btn btn-primary update">' + i18n('Update the marker') + '</button> <button type="button" class="btn btn-warning outdated">' + i18n('Not up-to-date') + '</button></div>';
        } else {
            content = content + '<div class="alert alert-warning">' + i18n('Reported not up-to-date') + '</div>';
        }
    }
    if (!has_name) {
        content = content + '<strong>';
    }
    if (marker.info != undefined && marker.info.bicycle_parking != undefined) {
        content = content + i18n('Bicycle stand') + ': ';
        if (marker.info.bicycle_parking == 'stands' || marker.info.bicycle_parking == 'wide_stands' || marker.info.bicycle_parking == 'wave' || marker.info.bicycle_parking == 'streetpod' || marker.info.bicycle_parking == 'bollard') {
            content = content + i18n('U type');
        } else if (marker.info.bicycle_parking == 'rack' || marker.info.bicycle_parking == 'racks') {
            content = content + i18n('A type');
        } else if (marker.info.bicycle_parking == 'shed' || marker.info.bicycle_parking == 'building') {
            content = content + i18n('enclosed');
        } else if (marker.info.bicycle_parking == 'informal') {
            content = content + i18n('informal');
        } else {
            content = content + i18n('not suitable');
        }
        content = content + '<br>';
    }
    if (marker.info != undefined && marker.info.amenity != undefined) {
        if (marker.info.amenity == 'bicycle_rental') {
            content = content + i18n('Bike sharing station') + '<br>';
        }
        if (marker.info.amenity == 'bicycle_repair_station') {
            content = content + i18n('Bicycle repair stand');
            content = content + '<br>';
        }
    }
    if (!has_name) {
        content = content + '</strong>';
    }
    if (marker.info != undefined && marker.info.amenity != undefined) {
        if (marker.info.amenity == 'bicycle_repair_station') {
            if (marker.info['service:bicycle:pump'] != undefined || marker.info['service:bicycle:tools'] != undefined) {
                if (marker.info['service:bicycle:pump'] == 'yes' || marker.info['service:bicycle:tools'] == 'yes') {
                    content = content + i18n('Equipment') + ': ';
                    if (marker.info['service:bicycle:pump'] == 'yes') {
                        content = content + i18n('pump');
                    }
                    if (marker.info['service:bicycle:pump'] == 'yes' && marker.info['service:bicycle:tools'] == 'yes') {
                        content = content + ',';
                    }
                    if (marker.info['service:bicycle:tools'] == 'yes') {
                        content = content + i18n('tools');
                    }
                }
                content = content + '<br>';
            }
        }
    }
    if (marker.info != undefined && marker.info.operator != undefined) {
        content = content + i18n('Operator') + ': ' + marker.info.operator + '<br>';
    }
    if (marker.info != undefined && marker.info.capacity != undefined) {
        content = content + i18n('Capacity') + ': ' + marker.info.capacity + '<br>';
    }
    if (marker.filename != undefined && marker.filename) {
        content = content + '<a href="' + getFilename(layer_id, marker.filename, false) + '" target="_blank"><img src="' + getFilename(layer_id, marker.filename) + '" alt="' + marker.filename + '" class="img-fluid"></a><br>';
    }
    if (signs != undefined && signs.length) {
        content = content + i18n('Path number') + ': ' + signs.join(', ') + '<br>';
    }
    var history = '';
    if (marker.marker_relations != undefined && marker.marker_relations.length) {
        for (var i = 0; i < marker.marker_relations.length; i++) {
            if (marker.marker_relations[i].child != undefined) {
                var child_description = marker.marker_relations[i].child.description ? marker.marker_relations[i].child.description.replace(/["]+/g, '') : '';
                history = history + '<tr data-toggle="tooltip" data-placement="bottom" title="' + child_description + '"><td width="20%">' + getDateFormatter().format(new Date(marker.marker_relations[i].child.created_at)) + '</td><td width="40%">' + marker.marker_relations[i].child.name;
                if (marker.marker_relations[i].url) {
                    history = history + '<br><a href="' + marker.marker_relations[i].url + '">' + i18n('Link') + '</a>';
                }
                history = history + '</td><td width="40%">';
                if (marker.marker_relations[i].child.url) {
                    history = history + '<a href="' + marker.marker_relations[i].child.url + '">' + i18n('Link') + '</a>';
                }
                if (marker.marker_relations[i].child.url && marker.marker_relations[i].child.filename) {
                    history = history + '<br>';
                }
                if (marker.marker_relations[i].child.filename) {
                    history = history + '<a href="' + getFilename(layer_id, marker.marker_relations[i].child.filename, false) + '" target="_blank"><img src="' + getFilename(layer_id, marker.marker_relations[i].child.filename) + '" alt="' + marker.marker_relations[i].child.name + '" class="img-fluid"></a>';
                }
                history = history + '</td></tr>';
            }
        }
    }
    if (history) {
        content = content + '<strong>' + i18n('History') + '</strong><table class="table table-sm table-striped">' + history + '</table>';
    }
    if (marker.info != undefined) {
        if (Object.keys(marker.info).length) {
            content = content + '<hr class="my-2"><p class="text-secondary mt-0">';
        }
        for (var detail_key in marker.info) {
            content = content + detail_key + ' = ' + marker.info[detail_key] + '<br>';
        }
        if (Object.keys(marker.info).length) {
            content = content + '</p>';
        }
    }
    return content;
}

/*
    @relation string "ref" key content, if exists (OSM files)
    @path_id string path/way id from DB or OSM files
*/
function createRelation(relation, path_id) {
    if (core.relations[relation] === undefined) {
        core.relations[relation] = [];
    }
    core.relations[relation].push(path_id);
}

/*
    Only the elements that were actually highlighted are kept, so that clearing the
    highlight does not have to walk every path element on the map.
*/
function removeHighlight() {
    if (core.highlighted) {
        core.highlighted.forEach(function(element) {
            element.classList.remove('highlight-path');
            element.classList.remove('highlight-marker');
        });
        core.highlighted = null;
    }
}

// if relation exists, highlight all segments of the way/path
function highlightPath() {
    removeHighlight();
    var path_layer = core.paths[resolvePathId(core.options.path_id)];
    if (path_layer == undefined) {
        return;
    }
    if (path_layer.options.relation != undefined) {
        var relation = path_layer.options.relation;
        core.highlighted = qsa('.' + relation);
        core.highlighted.forEach(function(element) {
            element.classList.add('highlight-path');
        });
    }
}

function highlightMarker() {
    removeHighlight();
    var marker = core.markers[core.options.marker_id];
    if (marker == undefined) {
        return;
    }
    var icon = marker._icon ? qs('div', marker._icon) : null;
    if (icon) {
        icon.classList.add('highlight-marker');
        core.highlighted = [icon];
    }
    map.panTo(marker.getLatLng());
}

/*
    @regex_rule string regex rule to apply instead of deafult one
*/
function normalize(text, regex_rule) {
    if (regex_rule === undefined) {
        regex_rule = /[^A-Za-z_-]/g;
    }
    var combining = /[\u0300-\u036F]/g;
    if (text === undefined || text === null) {
        return '';
    }
    text = String(text);
    // the same tag keys and values repeat across thousands of markers and paths
    var cache_key = regex_rule.source + '\u0000' + text;
    if (core.normalized[cache_key] !== undefined) {
        return core.normalized[cache_key];
    }
    var normalized = text.normalize('NFKD').replace(combining, '').toLowerCase();
    normalized = normalized.replace(/:/g, '-');
    normalized = normalized.replace(regex_rule, '');
    normalized = normalized.replace(/[\-]{2,}/g, '-');
    core.normalized[cache_key] = normalized;
    return normalized;
}

function getFilename(layer_id, filename, thumb = true) {
    if (filename === undefined || filename === null || filename === '') {
        return '';
    }
    // URL
    if (filename.indexOf('http://') != -1 || filename.indexOf('https://') != -1) {
        url = filename;
    } else {
        // default path to file in storage
        path = 'storage/';
        if (layer_id == core.editable_layer_id) {
            path = path + 'uploads/';
        } else {
            path = path + 'photos/';
            if (thumb) {
                path = path + 'thumbs/';
            }
        }
        url = core.storage_path + path + filename;
    }
    return url;
}

/*
    Centers the map on the visitor, if they allow it. The position is not stored
    anywhere and is not written into the location fragment.
*/
function locateUser() {
    if (navigator.geolocation == undefined) {
        openSidebar('<div class="alert alert-warning">' + i18n('Location is not supported by this browser.') + '</div>');
        return;
    }
    stopLocating();
    core.location_best_accuracy = false;
    /*
        The first answer is whatever the browser has at hand, which is the coarse wifi or
        IP based one. Watching keeps the device reporting, so the GPS fix replaces it as
        soon as it is acquired. setView is deliberately not used: it fits the accuracy
        bounds, which zooms the map back out to the whole city on a coarse fix.
    */
    map.locate({
        watch: true,
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: core.locate_max_wait
    });
    core.locate_timer = window.setTimeout(stopLocating, core.locate_max_wait);
}

function showLocation(e) {
    // a later reading is only used when the device has actually become more precise
    if (core.location_best_accuracy !== false && e.accuracy > core.location_best_accuracy) {
        return;
    }
    core.location_best_accuracy = e.accuracy;
    removeLocation();
    map.setView(e.latlng, Math.max(map.getZoom(), core.locate_zoom));
    core.location_marker = L.marker(e.latlng, {
        icon: new L.DivIcon({
            html: '<div class="own-location"></div>',
            // sized explicitly, so that the dot is centred on the reported position
            iconSize: [16, 16]
        }),
        interactive: false,
        keyboard: false
    }).addTo(map);
    // the browser reports how far off the position may be, but drawing a kilometres wide
    // circle just covers the map, so it is only shown when it says something useful
    if (e.accuracy && e.accuracy <= core.locate_accuracy_limit) {
        core.location_accuracy = L.circle(e.latlng, {
            radius: e.accuracy,
            className: 'own-location-accuracy',
            interactive: false
        }).addTo(map);
    }
    if (e.accuracy <= core.locate_accuracy_target) {
        stopLocating();
    }
}

function stopLocating() {
    if (core.locate_timer) {
        window.clearTimeout(core.locate_timer);
        core.locate_timer = false;
    }
    map.stopLocate();
}

function showLocationError() {
    stopLocating();
    // a fix that arrived earlier is still worth more than an error message
    if (core.location_marker) {
        return;
    }
    removeLocation();
    openSidebar('<div class="alert alert-warning">' + i18n('Your location could not be determined.') + '</div>');
}

function removeLocation() {
    if (core.location_marker) {
        map.removeLayer(core.location_marker);
        core.location_marker = false;
    }
    if (core.location_accuracy) {
        map.removeLayer(core.location_accuracy);
        core.location_accuracy = false;
    }
}

// e or force @array options lat, lng
function createMarker(e, options) {
    if (core.editable_marker) {
        map.removeLayer(core.editable_marker);
    }
    removeHighlight();
    if (e) {
        var lat = e.latlng.lat;
        var lng = e.latlng.lng;
    } else if (options) {
        var lat = options[0];
        var lng = options[1];
        var orig_id = options[2]
        var name = options[3];
        var type = options[4];
    }
    var template = qs('#form');
    openSidebar(template ? template.innerHTML : '');
    core.editable_marker = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], core.options.zoom);
    var form = qs('#sidebar-content form');
    if (form == null) {
        return;
    }
    setFieldValue(form, 'input[name=lat]', lat);
    setFieldValue(form, 'input[name=lon]', lng);
    if (orig_id) {
        setFieldValue(form, 'input[name=original_id]', orig_id);
    }
    if (name) {
        setFieldValue(form, 'input[name=name]', name);
    }
    if (type) {
        setFieldValue(form, 'select[name=type]', type);
    }
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        var action = form.getAttribute('action');
        // read before the sidebar is replaced, that detaches the form
        var form_data = new FormData(form);
        openSidebar(i18n('Creating... Please wait.'));
        fetch(action, {
            method: 'POST',
            body: form_data,
            headers: {
                'Accept': 'application/json'
            }
        }).then(function(response) {
            return response.json();
        }).then(function(data) {
            showSidebarMessage(data.success ? i18n('Thank you for making our map better. Your marker will be displayed after we review and accept your submission.') : i18n('Something failed. Please try again.'));
        }).catch(function() {
            showSidebarMessage(i18n('Something failed. Please try again.'));
        });
    });
}

function setFieldValue(form, selector, value) {
    var field = qs(selector, form);
    if (field) {
        field.value = value;
    }
}

function showSidebarMessage(message) {
    var sidebar_content = qs('#sidebar-content');
    if (sidebar_content) {
        sidebar_content.innerHTML = '<div class="alert alert-warning">' + message + '</div>';
    }
}

function toggleSidebarCheck(id, type) {
    if (id) {
        if (type == 'marker') {
            core.options.marker_id = id;
            core.options.path_id = undefined;
            rewriteFragment();
        } else if (type == 'path') {
            core.options.path_id = id;
            core.options.marker_id = undefined;
            highlightPath();
            rewriteFragment();
        }
    }
    qsa('#sidebar-content .share').forEach(function(element) {
        bindOnce(element, 'click', copyLink);
    });
    qsa('.update').forEach(function(element) {
        bindOnce(element, 'click', function() {
            createMarker(undefined, [core.markers[id]._latlng.lat, core.markers[id]._latlng.lng, id, core.markers[id].options.orig_name, core.markers[id].options.orig_editable_type]);
        });
    });
    qsa('.outdated').forEach(function(element) {
        bindOnce(element, 'click', function() {
            if (!element.classList.contains('toconfirm')) {
                qsa('.update').forEach(function(update) {
                    update.style.display = 'none';
                });
                element.classList.add('toconfirm');
                element.textContent = i18n('Click again to confirm.');
                return;
            }
            var update_help = qs('#update-help');
            if (update_help) {
                update_help.style.display = 'none';
            }
            var form_data = new FormData();
            form_data.append('id', id);
            var token = qs('input[name="_token"]');
            fetch('data/edit', {
                method: 'POST',
                body: form_data,
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': token ? token.value : ''
                }
            }).then(function(response) {
                return response.json();
            }).then(function(data) {
                showSidebarMessage(data.success ? i18n('Thank you for your notification. Administrator will verify your information and update the marker.') : i18n('Something failed. Please try again.'));
            }).catch(function() {
                showSidebarMessage(i18n('Something failed. Please try again.'));
            });
        });
    });
}

function describeBicycleInfrastructure(infrastructure_type) {
    if (infrastructure_type.indexOf('advisory') != -1) {
        return i18n('Advisory');
    } else if (infrastructure_type.indexOf('shared_lane') != -1) {
        return i18n('Sharrows');
    } else if (infrastructure_type.indexOf('share_busway') != -1) {
        return i18n('Bus & bike lane');
    } else if (infrastructure_type.indexOf('lane') != -1) {
        return i18n('Bike lane');
    } else if (infrastructure_type.indexOf('track') != -1) {
        return i18n('Bike track');
    } else if (infrastructure_type.indexOf('opposite') != -1 || infrastructure_type.indexOf('opposite_lane') != -1) {
        return i18n('Contraflow');
    } else if (infrastructure_type.indexOf('crossing') != -1) {
        return i18n('Crossing');
    }
    return '';
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function getEditableLayerId() {
    for (layer_id in core.config.layers) {
        if (core.config.layers[layer_id].editable && core.config.layers[layer_id].editable == true) {
            return layer_id;
        }
    }
    return false;
}

function copyLink(event) {
    // the button, the timeout below used to lose it and never cleared the class again
    var button = event.currentTarget;
    button.classList.add('clipboard');
    copyText(window.location.href);
    window.setTimeout(function() {
        button.classList.remove('clipboard');
    }, 1000);
}

function copyText(text) {
    if (navigator.clipboard != undefined && navigator.clipboard.writeText != undefined) {
        navigator.clipboard.writeText(text).catch(function() {
            copyTextFallback(text);
        });
        return;
    }
    copyTextFallback(text);
}

// the clipboard API needs a secure context, this covers the pages served over plain http
function copyTextFallback(text) {
    var temp_text = document.createElement('input');
    temp_text.value = text;
    document.body.appendChild(temp_text);
    temp_text.select();
    document.execCommand('copy');
    document.body.removeChild(temp_text);
}

function openSidebar(content) {
    // the tooltip would be left behind by the markup it belongs to
    hideTooltip();
    qs('#sidebar-content').innerHTML = content;
    qs('#sidebar').style.display = 'block';
    if (core.editable_marker) {
        map.removeLayer(core.editable_marker);
    }
    map.invalidateSize();
}

function closeSidebar() {
    hideTooltip();
    qs('#sidebar').style.display = 'none';
    removeObjectFragment();
    if (core.editable_marker) {
        map.removeLayer(core.editable_marker);
    }
    map.invalidateSize();
}
