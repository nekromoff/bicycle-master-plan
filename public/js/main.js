var core={};
core.options=[];
core.layers=[];
core.clusters=[];
core.markers=[];
core.paths=[];
core.layers_parsed=[];
core.options.popup_width=35*Math.max(document.documentElement.clientWidth, window.innerWidth || 0)/100; //50% of viewport
if (core.options.popup_width<200) {
    core.options.popup_width=200;
}
core.editable_marker=false;

$(document).ready(function() {
    // do form translations
    $('#form form label').each(function () { $(this).text(i18n($(this).text().trim())) });
    $('#form form small').each(function () { $(this).text(i18n($(this).text().trim())) });
    $('#form form button').each(function () { $(this).text(i18n($(this).text().trim())) });
    $('#intro_off').on('click', function() {
        setCookie('intro_off', 1, 180);
        map.closePopup();
    })
    // if location fragment exists on launch
    if (window.location.hash) {
        setupMap();
    } else {
        for (layer_key in core.config.default_layers) {
            if (core.config.default_layers[layer_key]!='base') {
                fetchLayer(core.config.default_layers[layer_key]);
            }
        }
    }
    map.on('overlayadd', function (e) {
        for (layer in core.layers) {
            if (core.layers[layer]==e.layer) {
                layer_id=getLayerId(layer);
                fetchLayer(layer_id);
            }
        }
    });
    map.on('moveend', rewriteFragment);
    map.on('zoomend', rewriteFragment);
    map.on('overlayadd', rewriteFragment);
    map.on('overlayremove', rewriteFragment);
    if (core.editable_layer_id) {
        map.on('contextmenu', createMarker);
    }
});

function forceOptions() {
    if (window.location.hash) {
        if (window.location.hash.trim().indexOf('|')!=-1) {
            parts=window.location.hash.trim().replace('#','').split('|');
        } else { // try encoded |
            parts=decodeURIComponent(window.location.hash).trim().replace('#','').split('|');
        }
        parts.forEach(function(part) {
            if (part.indexOf('l')!=-1) {
                core.options.layers_found=part.trim().replace('l','').split(',');
            }
            if (part.indexOf('z')!=-1) {
                core.options.zoom=part.trim().replace('z','');
            }
            if (part.indexOf('c')!=-1) {
                center=part.trim().replace('c','');
                core.options.center=center.split(',');
            }
        });
        console.log(parts);
    }
}

function setupMap() {
    parts=window.location.hash.replace('#','').split('|')
    parts.forEach(function(part) {
        if (part.indexOf('l')!=-1) {
            core.options.layers_found=part.replace('l','').split(',');
            toggleLayers(core.options.layers_found);
        }
        if (part.indexOf('z')!=-1) {
            core.options.zoom=part.replace('z','');
            map.setZoom(core.options.zoom);
        }
        if (part.indexOf('c')!=-1) {
            center=part.replace('c','');
            core.options.center=center.split(',');
            core.options.center['lat']=core.options.center[0];
            core.options.center['lng']=core.options.center[1];
            core.options.center[0]=undefined;
            core.options.center[1]=undefined;
            map.setView([core.options.center['lat'],core.options.center['lng']], core.options.zoom);
        }
        // open marker on load
        // if (part.indexOf('m')!=-1) {
        //     orig_marker_id=part.replace('m','');
        //     for (marker_id in core.markers) {
        //         if (core.markers[marker_id].options.orig_id==orig_marker_id) {
        //             core.markers[marker_id].openPopup();
        //         }
        //     marker_bounds = core.markers[marker_id].getLatLng();
        //     map.fitBounds(marker_bounds);
        //     }f
        // }
    });
}

function toggleLayers(layers_found) {
    for (layer in layers_found) {
        fetchLayer(layers_found[layer]);
    }
}

function rewriteFragment() {
    fragment='';
    core.layers_enabled=[];
    for (layer_id in core.layers_parsed) {
        layer_key='layer'+layer_id;
        layer_id=layer_id.toString();
        if (layer_id.indexOf('/')!=-1) {
            parts=layer_id.split('/');
            layer_key='layer'+parts[0]+'_type'+parts[1];
        }
        if (map.hasLayer(core.layers[layer_key])) {
            core.layers_enabled.push(layer_id);
        }
    }
    fragment=fragment+'l'+core.layers_enabled.join(',');
    fragment=fragment+'|z'+map.getZoom();
    core.options.center=map.getCenter();
    fragment=fragment+'|c'+core.options.center['lat'].toFixed(5)+','+core.options.center['lng'].toFixed(5);
    window.location.hash=fragment;
}

function getLayerId(layer) {
    layer_id=layer.replace('layer','')
    if (layer.indexOf('_type')!=-1) {
        layer_id=layer_id.replace('_type','/')
    }
    layer_id=layer_id.trim();
    return layer_id;
}

function fetchLayer(layer_id, type) {
    // if layer_id is entered as layer_id/type combo, separate them
    layer_id=layer_id.toString();
    if (layer_id.indexOf('/')!=-1) {
        parts=layer_id.split('/');
        layer_id=parts[0];
        type=parts[1];
    }
    url='data/layer/'+layer_id;
    if (type) {
        url=url+'/'+type;
    }
    jQuery.get(url).done(function(data) {
        parseLayer(data, layer_id, type);
    });
}

function parseLayer(data, layer_id, type) {
    var parsed_key=layer_id;
    if (type) {
        parsed_key=parsed_key+'/'+type;
    }
    if (!core.layers_parsed[parsed_key]) {
        parsePaths(data, layer_id, type);
        parseMarkers(data, layer_id, type);
        core.layers_parsed[parsed_key]=true;
    }
    if (core.config.layers[layer_id].types!=undefined && type) {
        map.addLayer(core.layers['layer'+layer_id+'_type'+type]);
    } else {
        map.addLayer(core.layers['layer'+layer_id]);
    }
    rewriteFragment();
}

function parsePaths(data, layer_id, type) {
    for (key in data.paths) {
        path=data.paths[key];
        classes='path';
        if (path.info!=undefined) {
            for (detail_key in path.info) {
                classes=classes+' '+normalize(detail_key)+'-'+normalize(path.info[detail_key])
            }
        }
        path_id=core.paths.length;
        core.paths[path_id]=L.polyline([path.nodes], { className: classes });
        popup_content='';
        if (path.info!=undefined) {
            if (path.info.name!=undefined && path.info.name) {
                popup_content=popup_content+'<strong>'+path.info.name+'</strong>';
            }
            if (path.info.ref!=undefined && path.info.ref) {
                popup_content=popup_content+'<br>'+i18n('Path number')+': '+path.info.ref;
                core.paths[path_id].setText(path.info.ref);
            }
            if (path.info.operator!=undefined && path.info.operator) {
                popup_content=popup_content+'<br>'+i18n('Operator')+': '+path.info.operator;
            }
            for (detail_key in path.info) {
                popup_content=popup_content+'<br>'+detail_key+'='+path.info[detail_key];
            }
        }
        // add popup
        if (popup_content) {
            core.paths[path_id].bindPopup(popup_content);
        }
        // add to layer
        if (core.config.layers[layer_id].types!=undefined && type) {
            core.paths[path_id].addTo(core.layers['layer'+layer_id+'_type'+type]);
        } else {
            core.paths[path_id].addTo(core.layers['layer'+layer_id]);
        }
    }
}

function parseMarkers(data, layer_id, type) {
    for (key in data.markers) {
        marker=data.markers[key];
        marker_content='<div class="'+normalize(marker.name)+' ';
        if (core.config.layers[layer_id].editable && core.config.layers[layer_id].editable_types) {
            marker_content=marker_content+normalize(core.config.layers[layer_id].editable_types[marker.type].class)+' ';
        }
        if (marker.info!=undefined) {
            for (key in marker.info) {
                marker_content=marker_content+normalize(key)+'-'+normalize(marker.info[key])+' ';
            }
        }
        if (marker.description!=undefined && marker.description) {
            marker_content=marker_content+'description-'+normalize(marker.description)+' ';
        }

        if (core.config.layers[layer_id].types!=undefined) {
            marker_content=marker_content+normalize(core.config.layers[layer_id].types[type].class)+'">';
            if (core.config.layers[layer_id].types[type].icon=='name') {
                marker_content=marker_content+marker.name+'</div>';
            } else if (core.config.layers[layer_id].types[type].icon=='filename') {
                marker_content=marker_content+'<img src="' + getFilename(layer_id, marker.filename) + '" alt="' + marker.filename + '">';
            }
        } else {
            marker_content=marker_content+core.config.layers[layer_id].class+'">';
            if (core.config.layers[layer_id].icon=='name') {
                marker_content=marker_content+marker.name+'</div>';
            } else if (core.config.layers[layer_id].icon=='filename') {
                marker_content=marker_content+'<img src="' + getFilename(layer_id, marker.filename) + '" alt="' + marker.filename + '">';
            }
        }

        marker_content=marker_content+'</div>';
        marker_id=core.markers.length;
        core.markers[marker_id]=L.marker([marker.lat,marker.lon], { icon: new L.DivIcon({ html: marker_content }), orig_id: marker.id, orig_type: marker.type });
        popup_content='';
        if (marker.name!=undefined && marker.name) {
            popup_content=popup_content+'<strong>'+marker.name+'</strong>';
        } else if (marker.info!=undefined && marker.info.name) {
            popup_content=popup_content+'<strong>'+marker.info.name+'</strong>';
        }
        if (marker.description!=undefined && marker.description) {
            popup_content=popup_content+'<br>'+marker.description;
        } else if (marker.info!=undefined && marker.info.description) {
            popup_content=popup_content+'<br>'+marker.info.description;
        }
        if (marker.info!=undefined && marker.info.bicycle_parking!=undefined) {
            popup_content=popup_content+'<br>'+i18n('Bicycle stand')+': ';
            if (marker.info.bicycle_parking=='stands' || marker.info.bicycle_parking=='wide_stands') {
                popup_content=popup_content+i18n('U type (safe)');
            } else if (marker.info.bicycle_parking=='rack' || marker.info.bicycle_parking=='racks') {
                popup_content=popup_content+i18n('A type (safe)');
            } else if (marker.info.bicycle_parking=='shed') {
                popup_content=popup_content+i18n('covered (safe)');
            } else if (marker.info.bicycle_parking=='informal') {
                popup_content=popup_content+i18n('informal (railing etc.)');
            } else {
                popup_content=popup_content+i18n('not suitable');
            }
        }
        if (marker.filename!=undefined && marker.filename) {
            popup_content=popup_content+'<br><a href="' + getFilename(layer_id, marker.filename, false) + '" target="_blank"><img src="' + getFilename(layer_id, marker.filename) + '" alt="' + marker.filename + '"></a>';
        }
        if (marker.relations!=undefined && marker.relations.length) {
            popup_content=popup_content+'<br>'+i18n('Path number')+': ';
            for (key in marker.relations) {
                popup_content=popup_content+data.cycleways[marker.relations[key].cycleway_id].sign;
                if (marker.relations.length>key+1) {
                    popup_content=popup_content+', ';
                }
            }
        }
        if (marker.info!=undefined) {
            for (key in marker.info) {
                popup_content=popup_content+'<br>'+key+' = '+marker.info[key];
            }
        }
        // add popup
        if (popup_content) {
            core.markers[marker_id].bindPopup(popup_content);
        }
        // add to layer
        if (core.config.layers[layer_id].types!=undefined && type) {
            core.markers[marker_id].addTo(core.layers['layer'+layer_id+'_type'+type]);
        } else {
            core.markers[marker_id].addTo(core.layers['layer'+layer_id]);
        }
    }
}

function normalize(text) {
    var combining = /[\u0300-\u036F]/g;
    text=text.normalize('NFKD').replace(combining, '').toLowerCase();
    text=text.replace(':','-');
    text=text.replace(/[^A-Za-z_-]/g,'');
    text=text.replace(/[\-]{2,}/g,'-');
    return text;
}

function getFilename(layer_id, filename, thumb = true) {
    // URL
    if (filename.indexOf('http://')!=-1 || filename.indexOf('https://')!=-1) {
        url = filename;
    } else {
        // default path to file in storage
        path = 'storage/';
        if (layer_id==core.editable_layer_id) {
            path = path+'uploads/';
        } else {
            path = path+'photos/';
            if (thumb) {
                path=path+'thumbs/';
            }
        }
        url = core.storage_path+path+filename;
    }
    return url;
}

function createMarker(e) {
    if (core.editable_marker) {
        map.removeLayer(core.editable_marker);
    }
    core.editable_marker=L.marker([e.latlng.lat, e.latlng.lng]).addTo(map).bindPopup($('#form').clone().attr('id', 'editable').html(), { minWidth: core.options.popup_width, keepInView: true }).openPopup().on('popupclose', function(e) { map.removeLayer(core.editable_marker); });
    $('.leaflet-popup-content form input[name=lat]').val(e.latlng.lat);
    $('.leaflet-popup-content form input[name=lon]').val(e.latlng.lng);
    $('.leaflet-popup-content form').on('submit', function(e) {
        action=$('.leaflet-popup-content form').clone().attr('action');
        core.editable_marker.setPopupContent(i18n('Creating... Please wait.'));
        $.ajax({
            type: 'POST',
            url: action,
            data: new FormData(this),
            dataType: 'json',
            contentType: false,
            cache: false,
            processData:false,
            success: function(data) {
                if (data.success) {
                    message=i18n('Thank you for making our map better. Your marker will be displayed after we review and accept your submission.');
                } else {
                    message=i18n('Something failed. Please try again.');
                }
                core.editable_marker.setPopupContent(message);
            }
        });
        pushEvent('markersubmit');
        return false;
    });
}

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
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
        dataLayer.push({event: datalayer_event});
    }
}

function findEditableLayer() {
    for (layer_id in core.config.layers) {
        if (core.config.layers[layer_id].editable && core.config.layers[layer_id].editable==true) {
            return layer_id;
        }
    }
    return false;
}