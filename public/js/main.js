var core = {};
core.options = [];
core.layers = [];
core.clusters = [];
core.markers = [];
core.paths = [];
core.relations = [];
core.layers_parsed = [];
core.options.popup_width = 35 * Math.max(document.documentElement.clientWidth, window.innerWidth || 0) / 100; //50% of viewport
if (core.options.popup_width < 200) {
    core.options.popup_width = 200;
}
core.editable_marker = false;

$(document).ready(function() {
    // do form translations
    $('#form form label').each(function() {
        $(this).text(i18n($(this).text().trim()))
    });
    $('#form form small').each(function() {
        $(this).text(i18n($(this).text().trim()))
    });
    $('#form form button').each(function() {
        $(this).text(i18n($(this).text().trim()))
    });
    $('#intro_off').on('click', function() {
        setCookie('intro_off', 1, 180);
        map.closePopup();
    });
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
        for (layer in core.layers) {
            if (core.layers[layer] == e.layer) {
                layer_id = getLayerId(layer);
                fetchLayer(layer_id);
            }
        }
    });
    map.on('moveend', rewriteFragment);
    map.on('zoomend', rewriteFragment);
    map.on('zoomend', changeZoomClass);
    map.on('overlayadd', rewriteFragment);
    map.on('overlayremove', rewriteFragment);
    if (core.editable_layer_id) {
        map.on('contextmenu', createMarker);
    }
    map.on('popupopen', togglePopupCheck);
    map.on('popupclose', removeObjectFragment);
    $('[data-toggle="tooltip"]').tooltip();
});

function forceOptions() {
    if (window.location.hash) {
        if (window.location.hash.trim().indexOf('|') != -1) {
            parts = window.location.hash.trim().replace('#', '').split('|');
        } else { // try encoded |
            parts = decodeURIComponent(window.location.hash).trim().replace('#', '').split('|');
        }
        parts.forEach(function(part) {
            if (part.indexOf('l') != -1) {
                core.options.layers_found = part.trim().replace('l', '').split(',');
            }
            if (part.indexOf('z') != -1) {
                core.options.zoom = part.trim().replace('z', '');
            }
            if (part.indexOf('c') != -1) {
                center = part.trim().replace('c', '');
                core.options.center = center.split(',');
            }
        });
    }
}

function setupMap() {
    if (window.location.hash.trim().indexOf('|') != -1) {
        parts = window.location.hash.trim().replace('#', '').split('|');
    } else { // try encoded |
        parts = decodeURIComponent(window.location.hash).trim().replace('#', '').split('|');
    }
    parts.forEach(function(part) {
        if (part.indexOf('l') != -1) {
            core.options.layers_found = part.trim().replace('l', '').split(',');
            toggleLayers(core.options.layers_found);
        }
        if (part.indexOf('z') != -1) {
            core.options.zoom = part.trim().replace('z', '');
        }
        if (part.indexOf('c') != -1) {
            center = part.trim().replace('c', '');
            core.options.center = center.split(',');
            core.options.center['lat'] = core.options.center[0];
            core.options.center['lng'] = core.options.center[1];
            core.options.center[0] = undefined;
            core.options.center[1] = undefined;
            map.setView([core.options.center['lat'], core.options.center['lng']], core.options.zoom);
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

function toggleLayers(layers_found) {
    for (layer in layers_found) {
        fetchLayer(layers_found[layer]);
    }
}

function rewriteFragment() {
    fragment = '';
    core.layers_enabled = [];
    for (layer_id in core.layers_parsed) {
        layer_key = 'layer' + layer_id;
        layer_id = layer_id.toString();
        if (layer_id.indexOf('/') != -1) {
            parts = layer_id.split('/');
            layer_key = 'layer' + parts[0] + '_type' + parts[1];
        }
        if (map.hasLayer(core.layers[layer_key])) {
            core.layers_enabled.push(layer_id);
        }
    }
    fragment = fragment + 'l' + core.layers_enabled.join(',');
    core.options.zoom = map.getZoom();
    fragment = fragment + '|z' + core.options.zoom;
    core.options.center = map.getCenter();
    fragment = fragment + '|c' + core.options.center['lat'].toFixed(5) + ',' + core.options.center['lng'].toFixed(5);
    if (core.options.path_id) {
        fragment = fragment + '|p' + core.options.path_id;
    }
    if (core.options.marker_id) {
        fragment = fragment + '|m' + core.options.marker_id;
    }
    window.location.hash = fragment;
}

function changeZoomClass() {
    for (var i = map.getMinZoom(); i <= map.getMaxZoom(); i++) {
        $('#map').removeClass('z' + i);
    }
    $('#map').addClass('z' + Math.floor(map.getZoom()));
}

function removeObjectFragment() {
    $('.highlighted').removeClass('highlighted');
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
    if (layer_id.indexOf('/') != -1)  {
        parts = layer_id.split('/');
        layer_id = parts[0];
        type = parts[1];
    }
    url = 'data/layer/' + layer_id;
    if (type) {
        url = url + '/' + type;
    }
    jQuery.get(url).done(function(data) {
        parseLayer(data, layer_id, type);
    });
}

function parseLayer(data, layer_id, type) {
    var parsed_key = layer_id;
    if (type) {
        parsed_key = parsed_key + '/' + type;
    }
    if (!core.layers_parsed[parsed_key]) {
        parsePaths(data, layer_id, type);
        parseMarkers(data, layer_id, type);
        core.layers_parsed[parsed_key] = true;
    }
    if (core.config.layers[layer_id].types != undefined && type) {
        map.addLayer(core.layers['layer' + layer_id + '_type' + type]);
    } else {
        map.addLayer(core.layers['layer' + layer_id]);
    }
    rewriteFragment();
    if (core.options.marker_id != undefined && core.markers[core.options.marker_id] != undefined) {
        core.markers[core.options.marker_id].openPopup();
        togglePopupCheck(undefined, [core.options.marker_id, 'marker']);
        map.panTo(core.markers[core.options.marker_id].getLatLng());
    }
    if (core.options.path_id != undefined && core.paths[core.options.path_id] != undefined) {
        highlightPath();
        core.paths[core.options.path_id].openPopup();
        togglePopupCheck(undefined, [core.options.path_id, 'path']);
    }
}

function parsePaths(data, layer_id, type) {
    for (key in data.paths) {
        path = data.paths[key];
        classes = 'path';
        var polyline_options = {
            orig_id: path.id,
            orig_type: 'path'
        };
        if (path.info != undefined) {
            // define relation, if ref exists
            if (path.info.ref != undefined) {
                var relation = normalize(path.info.ref, /[^A-Za-z0-9_-]/g);
                polyline_options.relation = relation;
                createRelation(relation, path.id);
            }
            /* // same name applies to different type of segments, so maybe not the best solution
             else if (path.info.name != undefined && path.info.name) {
                var relation = normalize(path.info.name, /[^A-Za-z0-9_-]/g);
                polyline_options.relation = relation;
                createRelation(relation, path.id);
            }
            */
            for (detail_key in path.info) {
                classes = classes + ' ' + normalize(detail_key) + '-' + normalize(path.info[detail_key], /[^A-Za-z0-9_-]/g)
            }
        }
        polyline_options.className = classes;
        core.paths[path.id] = L.polyline([path.nodes], polyline_options);
        popup_content = '';
        if (path.info != undefined) {
            if (path.info.name != undefined && path.info.name) {
                popup_content = popup_content + '<strong>' + path.info.name + '</strong>';
            }
            popup_content = popup_content + '<a href="" class="float-right share" data-toggle="tooltip" data-placement="top" title="' + i18n('Copy link to clipboard') + '">🔗</a>';
            if (path.info.name == undefined) {
                popup_content = popup_content + '<strong>';
            }
            if (path.info.highway != undefined && path.info.highway == 'cycleway') {
                popup_content = popup_content + '<br>' + i18n('Marking') + ': ' + i18n('Segregated bike lane');
            }
            if (path.info.railway != undefined && path.info.railway == 'tram' && path.info.bicycle != undefined && path.info.bicycle) {
                popup_content = popup_content + '<br>' + i18n('Marking') + ': ' + i18n('Tram & bicycle access');
            }
            if (path.info.highway != undefined && path.info.cycleway == undefined && (path.info.highway == 'pedestrian' || path.info.highway == 'footway' || path.info.highway == 'path') && path.info.bicycle != undefined && path.info.bicycle) {
                if ((path.info.motorcar != undefined && path.info.motorcar == 'no') || (path.info['motor_vehicle'] != undefined && path.info['motor_vehicle'] == 'no') && path.info.bicycle == 'yes') {
                    popup_content = popup_content + '<br>' + i18n('Marking') + ': ' + i18n('No motor vehicles');
                } else if (path.info.bicycle == 'yes' || path.info.bicycle == 'designated') {
                    popup_content = popup_content + '<br>' + i18n('Marking') + ': ' + i18n('Shared-use path');
                }
            }
            if (path.info['cycleway:lane'] != undefined && path.info['cycleway:lane']) {
                popup_content = popup_content + '<br>' + i18n('Marking') + ': ';
                popup_content = popup_content + describeBicycleInfrastructure(path.info['cycleway:lane']);
            } else if (path.info.cycleway != undefined && path.info.cycleway) {
                popup_content = popup_content + '<br>' + i18n('Marking') + ': ';
                popup_content = popup_content + describeBicycleInfrastructure(path.info.cycleway);
            }
            if (path.info['cycleway:left'] != undefined && path.info['cycleway:left']) {
                popup_content = popup_content + '<br>' + i18n('Marking') + ': ';
                popup_content = popup_content + describeBicycleInfrastructure(path.info['cycleway:left']);
                popup_content = popup_content + ' (' + i18n('Left side') + ') ';
            }
            if (path.info['cycleway:right'] != undefined && path.info['cycleway:right']) {
                popup_content = popup_content + '<br>' + i18n('Marking') + ': ';
                popup_content = popup_content + describeBicycleInfrastructure(path.info['cycleway:right']);
                popup_content = popup_content + ' (' + i18n('Right side') + ') ';
            }
            if (path.info.name == undefined) {
                popup_content = popup_content + '</strong>';
            }
            if (path.info.ref != undefined && path.info.ref) {
                popup_content = popup_content + '<br>' + i18n('Path number') + ': ' + path.info.ref;
                core.paths[path.id].setText(path.info.ref);
            }
            if (path.info.operator != undefined && path.info.operator) {
                popup_content = popup_content + '<br>' + i18n('Operator') + ': ' + path.info.operator;
            }
            for (detail_key in path.info) {
                popup_content = popup_content + '<br>' + detail_key + '=' + path.info[detail_key];
            }
        }
        // add popup
        if (popup_content) {
            core.paths[path.id].bindPopup(popup_content);
        }
        // add to layer
        if (core.config.layers[layer_id].types != undefined && type) {
            core.paths[path.id].addTo(core.layers['layer' + layer_id + '_type' + type]);
        } else {
            core.paths[path.id].addTo(core.layers['layer' + layer_id]);
        }
    }
}

function parseMarkers(data, layer_id, type)  {
    for (key in data.markers) {
        marker = data.markers[key];
        marker_content = '<div class="marker ' + normalize(marker.name) + ' ';
        if (core.config.layers[layer_id].editable && core.config.layers[layer_id].editable_types) {
            marker_content = marker_content + normalize(core.config.layers[layer_id].editable_types[marker.type].class) + ' ';
        }
        if (marker.info != undefined) {
            for (key in marker.info) {
                // keep numbers for "ref" key content
                marker_content = marker_content + normalize(key) + '-' + normalize(marker.info[key], /[^A-Za-z0-9_-]/g) + ' ';

            }
        }
        if (marker.description != undefined && marker.description) {
            marker_content = marker_content + 'description-' + normalize(marker.description) + ' ';
        }
        if (core.config.layers[layer_id].types != undefined) {
            marker_content = marker_content + normalize(core.config.layers[layer_id].types[type].class) + '">';
            if (core.config.layers[layer_id].types[type].icon == 'name') {
                marker_content = marker_content + marker.name + '</div>';
            } else if (core.config.layers[layer_id].types[type].icon == 'filename') {
                marker_content = marker_content + '<img src="' + getFilename(layer_id, marker.filename) + '" alt="' + marker.filename + '" class="img-fluid">';
            }
        } else {
            marker_content = marker_content + core.config.layers[layer_id].class + '">';
            if (core.config.layers[layer_id].icon == 'name') {
                marker_content = marker_content + marker.name + '</div>';
            } else if (core.config.layers[layer_id].icon == 'filename') {
                marker_content = marker_content + '<img src="' + getFilename(layer_id, marker.filename) + '" alt="' + marker.filename + '" class="img-fluid>';
            }
        }

        var history = '';
        if (marker.marker_relations != undefined && marker.marker_relations.length) {
            for (var i = 0; i < marker.marker_relations.length; i++) {
                if (marker.marker_relations[i].child != undefined) {
                    history = history + '<tr data-toggle="tooltip" data-placement="bottom" title="' + marker.marker_relations[i].child.description.replace(/["]+/g, '') + '"><td class="col-md-3">' + formatter.format(new Date(marker.marker_relations[i].child.created_at)) + '</td><td class="col-md-4">' + marker.marker_relations[i].child.name;
                    if (marker.marker_relations[i].url) {
                        history = history + '<br><a href="' + marker.marker_relations[i].url + '">' + i18n('Link') + '</a>';
                    }
                    history = history + '</td><td class="col-md-2">';
                    if (marker.marker_relations[i].child.url) {
                        history = history + '<a href="' + marker.marker_relations[i].child.url + '">' + i18n('Link') + '</a>';
                    }
                    if (marker.marker_relations[i].child.url && marker.marker_relations[i].child.filename) {
                        history = history + '<br>';
                    }
                    if (marker.marker_relations[i].child.filename) {
                        history = history + '<a href="' + getFilename(layer_id, marker.marker_relations[i].child.filename, false) + '" target="_blank"><img src="' + getFilename(layer_id, marker.marker_relations[i].child.filename) + '" alt="' + marker.filename + '" class="img-fluid"></a>';
                    }
                    history = history + '</td></tr>';
                }
            }
        }

        marker_content = marker_content + '</div>';
        core.markers[marker.id] = L.marker([marker.lat, marker.lon], {
            icon: new L.DivIcon({
                html: marker_content
            }),
            orig_id: marker.id,
            orig_type: 'marker',
            orig_name: marker.name,
            orig_editable_type: marker.type
        });
        popup_content = '';
        if (marker.name != undefined && marker.name) {
            popup_content = popup_content + '<strong>' + marker.name + '</strong>';
        } else if (marker.info != undefined && marker.info.name) {
            popup_content = popup_content + '<strong>' + marker.info.name + '</strong>';
        }
        popup_content = popup_content + '<a href="" class="float-right share" data-toggle="tooltip" data-placement="top" title="' + i18n('Copy link to clipboard') + '">🔗</a>';
        if (marker.url != undefined && marker.url) {
            popup_content = popup_content + '<br><a href="' + marker.url + '">' + i18n('Link') + '</a>';
        }
        if (marker.description != undefined && marker.description) {
            popup_content = popup_content + '<br>' + marker.description;
        } else if (marker.info != undefined && marker.info.description) {
            popup_content = popup_content + '<br>' + marker.info.description;
        }
        if (layer_id == core.editable_layer_id && marker.date_reported != undefined) {
            formatter = new Intl.DateTimeFormat(core.config.language, {
                year: 'numeric',
                month: 'short',
                day: '2-digit'
            });
            popup_content = popup_content + '<br><strong>' + i18n('Reported on') + ':</strong> ' + formatter.format(new Date(marker.date_reported));
            if (marker.outdated == 0) {
                popup_content = popup_content + '<small class="form-text text-muted" id="update-help">' + i18n('Provide more info') + '</small><button type="button" class="btn btn-primary btn-sm update">' + i18n('Update the marker') + '</button> <button type="button" class="btn btn-warning btn-sm outdated">' + i18n('Not up-to-date') + '</button>';
            } else {
                popup_content = popup_content + '<div class="alert alert-warning">' + i18n('Reported not up-to-date') + '</div>';
            }
        }
        if (marker.name == undefined) {
            popup_content = popup_content + '<strong>';
        }
        if (marker.info != undefined && marker.info.bicycle_parking != undefined) {
            popup_content = popup_content + '<br>' + i18n('Bicycle stand') + ': ';
            if (marker.info.bicycle_parking == 'stands' || marker.info.bicycle_parking == 'wide_stands') {
                popup_content = popup_content + i18n('U type (safe)');
            } else if (marker.info.bicycle_parking == 'rack' || marker.info.bicycle_parking == 'racks') {
                popup_content = popup_content + i18n('A type (safe)');
            } else if (marker.info.bicycle_parking == 'shed') {
                popup_content = popup_content + i18n('covered (safe)');
            } else if (marker.info.bicycle_parking == 'informal') {
                popup_content = popup_content + i18n('informal (railing etc.)');
            } else if (marker.info.bicycle_parking == 'informal') {
                popup_content = popup_content + i18n('informal (railing etc.)');
            } else {
                popup_content = popup_content + i18n('not suitable');
            }
        }
        if (marker.info != undefined && marker.info.amenity != undefined) {
            if (marker.info.amenity == 'bicycle_rental') {
                popup_content = popup_content + '<br>' + i18n('Bike sharing station');
            }
            if (marker.info.amenity == 'bicycle_repair_station') {
                popup_content = popup_content + '<br>' + i18n('Bicycle repair stand');
                if (marker.info['service:bicycle:pump'] != undefined || marker.info['service:bicycle:tools'] != undefined) {
                    if (marker.info['service:bicycle:pump'] == 'yes' || marker.info['service:bicycle:tools'] == 'yes') {
                        popup_content = popup_content + '<br>' + i18n('Equipment') + ': ';
                        if (marker.info['service:bicycle:pump'] == 'yes') {
                            popup_content = popup_content + i18n('pump');
                        }
                        if (marker.info['service:bicycle:pump'] == 'yes' && marker.info['service:bicycle:tools'] == 'yes') {
                            popup_content = popup_content + ',';
                        }
                        if (marker.info['service:bicycle:tools'] == 'yes') {
                            popup_content = popup_content + i18n('tools');
                        }
                    }
                }
            }
        }
        if (marker.name == undefined) {
            popup_content = popup_content + '</strong>';
        }
        if (marker.info != undefined && marker.info.operator != undefined) {
            popup_content = popup_content + '<br>' + i18n('Operator') + ': ' + marker.info.operator;
        }
        if (marker.info != undefined && marker.info.capacity != undefined) {
            popup_content = popup_content + '<br>' + i18n('Capacity') + ': ' + marker.info.capacity;
        }
        if (marker.filename != undefined && marker.filename) {
            popup_content = popup_content + '<br><a href="' + getFilename(layer_id, marker.filename, false) + '" target="_blank"><img src="' + getFilename(layer_id, marker.filename) + '" alt="' + marker.filename + '"></a>';
        }
        if (marker.relations != undefined && marker.relations.length) {
            popup_content = popup_content + '<br>' + i18n('Path number') + ': ';
            for (key in marker.relations) {
                popup_content = popup_content + data.cycleways[marker.relations[key].cycleway_id].sign;
                if (marker.relations.length > key + 1) {
                    popup_content = popup_content + ', ';
                }
            }
        }
        if (history) {
            popup_content = popup_content + '<br><strong>' + i18n('History') + '</strong><table class="table table-sm table-striped">' + history + '</table>';
        }
        if (marker.info != undefined) {
            for (key in marker.info) {
                popup_content = popup_content + '<br>' + key + ' = ' + marker.info[key];
            }
        }
        // add popup
        if (popup_content)  {
            core.markers[marker.id].bindPopup(popup_content);
        }
        // add to layer
        if (core.config.layers[layer_id].types != undefined && type) {
            core.markers[marker.id].addTo(core.layers['layer' + layer_id + '_type' + type]);
        } else {
            core.markers[marker.id].addTo(core.layers['layer' + layer_id]);
        }
    }
}

/*
    @relation string "ref" key content, if exists (OSM files)
    @path_id string path/way id from DB or OSM files
*/
function createRelation(relation, path_id) {
    if (core.relations[relation] === undefined) {
        core.relations[relation] = [];
    }
    core.relations[relation].push(path.id);
}

// if relation exists, highlight all segments of the way/path
function highlightPath() {
    if (core.paths[core.options.path_id].options.relation != undefined) {
        var relation = core.paths[core.options.path_id].options.relation;
        // try ref class first
        var relation_class = '.ref-' + relation;
        $(relation_class).addClass('highlighted');
        // try name class next
        relation_class = '.name-' + relation;
        $(relation_class).addClass('highlighted');
    }
}

/*
    @regex_rule string regex rule to apply instead of deafult one
*/
function normalize(text, regex_rule) {
    if (regex_rule === undefined) {
        regex_rule = /[^A-Za-z_-]/g;
    }
    var combining = /[\u0300-\u036F]/g;
    text = text.normalize('NFKD').replace(combining, '').toLowerCase();
    text = text.replace(':', '-');
    text = text.replace(regex_rule, '');
    text = text.replace(/[\-]{2,}/g, '-');
    return text;
}

function getFilename(layer_id, filename, thumb = true) {
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

// e or force @array options lat, lng
function createMarker(e, options) {
    if (core.editable_marker) {
        map.removeLayer(core.editable_marker);
    }
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
    core.editable_marker = L.marker([lat, lng]).addTo(map).bindPopup($('#form').clone().attr('id', 'editable').html(), {
        minWidth: core.options.popup_width,
        keepInView: true
    }).openPopup().on('popupclose', function(e) {
        map.removeLayer(core.editable_marker);
    });
    $('.leaflet-popup-content form input[name=lat]').val(lat);
    $('.leaflet-popup-content form input[name=lon]').val(lng);
    if (orig_id) {
        $('.leaflet-popup-content form input[name=original_id]').val(orig_id);
    }
    if (name) {
        $('.leaflet-popup-content form input[name=name]').val(name);
    }
    if (type) {
        $('.leaflet-popup-content form select[name=type]').val(type);
    }
    $('.leaflet-popup-content form').on('submit', function(e)  {
        action = $('.leaflet-popup-content form').clone().attr('action');
        core.editable_marker.setPopupContent(i18n('Creating... Please wait.'));
        $.ajax({
            type: 'POST',
            url: action,
            data: new FormData(this),
            dataType: 'json',
            contentType: false,
            cache: false,
            processData: false,
            success: function(data) {
                if (data.success) {
                    message = i18n('Thank you for making our map better. Your marker will be displayed after we review and accept your submission.');
                } else {
                    message = i18n('Something failed. Please try again.');
                }
                core.editable_marker.setPopupContent(message);
            }
        });
        pushEvent('markersubmit');
        return false;
    });
}

// e or force @array options = [object_id, object_type]
function togglePopupCheck(e, options)  {
    var object_id, object_type;
    if (e && e.popup._source != undefined) {
        object_id = e.popup._source.options.orig_id;
        object_type = e.popup._source.options.orig_type;
    } else if (options) {
        object_id = options[0];
        object_type = options[1];
    }
    if (object_id) {
        if (object_type == 'marker') {
            core.options.marker_id = object_id;
            rewriteFragment();
        } else if (object_type == 'path') {
            core.options.path_id = object_id;
            highlightPath();
            rewriteFragment();
        }
    }
    $('.leaflet-popup-content a.share').off();
    $('.leaflet-popup-content a.share').attr('href', window.location);
    $('.leaflet-popup-content a.share').on('click', copyLink);
    $('[data-toggle="tooltip"]').tooltip();
    $('.update').on('click', function() {
        createMarker(undefined, [core.markers[object_id]._latlng.lat, core.markers[object_id]._latlng.lng, object_id, core.markers[object_id].options.orig_name, core.markers[object_id].options.orig_editable_type]);
    });
    $('.outdated').on('click', function() {
        var parent = this;
        if (!$(this).hasClass('toconfirm')) {
            $('#update-help').hide();
            $('.update').hide();
            $(this).addClass('toconfirm');
            $(this).text(i18n('Click again to confirm.'));
        } else {
            var form_data = new FormData();
            form_data.append('id', object_id);
            $.ajax({
                type: 'POST',
                url: 'data/edit',
                headers: {
                    'X-CSRF-TOKEN': $('input[name="_token"]').val()
                },
                data: form_data,
                dataType: 'json',
                contentType: false,
                cache: false,
                processData: false,
                success: function(data) {
                    if (data.success) {
                        message = i18n('Thank you for your notification. Administrator will verify your information and update the marker.');
                    } else {
                        message = i18n('Something failed. Please try again.');
                    }
                    $(parent).replaceWith('<div class="alert alert-warning">' + message + '</div>')
                }
            });
            pushEvent('markeredit');
            return false;
        }
    });
}

function describeBicycleInfrastructure(infrastructure_type) {
    if (infrastructure_type == 'advisory') {
        return i18n('Advisory');
    } else if (infrastructure_type == 'shared_lane') {
        return i18n('Sharrows');
    } else if (infrastructure_type == 'share_busway') {
        return i18n('Bus & bike lane');
    } else if (infrastructure_type == 'lane') {
        return i18n('Bike lane');
    } else if (infrastructure_type == 'opposite' || infrastructure_type == 'opposite_lane') {
        return i18n('Contraflow');
    } else if (infrastructure_type == 'crossing') {
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

function pushEvent(datalayer_event) {
    if (dataLayer) {
        dataLayer.push({
            event: datalayer_event
        });
    }
}

function getEditableLayerId() {
    for (layer_id in core.config.layers) {
        if (core.config.layers[layer_id].editable && core.config.layers[layer_id].editable == true) {
            return layer_id;
        }
    }
    return false;
}

function copyLink() {
    $(this).addClass('clipboard');
    var link = $(this)[0];
    var temp_text = document.createElement('input');
    temp_text.value = link.href;
    document.body.appendChild(temp_text);
    temp_text.select();
    document.execCommand('copy');
    document.body.removeChild(temp_text);
    console.log(temp_text, 'copied');
    window.setTimeout(function() {
        $(this).removeClass('clipboard');
    }, 1000)
}