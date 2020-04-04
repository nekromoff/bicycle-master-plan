var core={};
core.options=[];
core.layers=[];
core.clusters=[];
core.markers=[];
core.paths=[];

core.layers_parsed=[];

$(document).ready(function() {
    // if location fragment exists on launch
    if (window.location.hash) {
        map.closePopup(intro);
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
});

function forceOptions() {
    if (window.location.hash) {
        parts=window.location.hash.replace('#','').split('|')
        parts.forEach(function(part) {
            if (part.indexOf('l')!=-1) {
                core.options.layers_found=part.replace('l','').split(',');
            }
            if (part.indexOf('z')!=-1) {
                core.options.zoom=part.replace('z','');
            }
            if (part.indexOf('c')!=-1) {
                center=part.replace('c','');
                core.options.center=center.split(',');
            }
        });
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
                popup_content=popup_content+'<br>Path number: '+path.info.ref;
                core.paths[path_id].setText(path.info.ref);
            }
            if (path.info.operator!=undefined && path.info.operator) {
                popup_content=popup_content+'<br>Operator: '+path.info.operator;
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
                console.log(marker);
                marker_content=marker_content+'<img src="' + getFilename(marker.filename) + '" alt="' + marker.filename + '">';
            }
        } else {
            marker_content=marker_content+core.config.layers[layer_id].class+'">';
            if (core.config.layers[layer_id].icon=='name') {
                marker_content=marker_content+marker.name+'</div>';
            } else if (core.config.layers[layer_id].icon=='filename') {
                marker_content=marker_content+'<img src="' + getFilename(marker.filename) + '" alt="' + marker.filename + '">';
            }
        }

        marker_content=marker_content+'</div>';
        marker_id=core.markers.length;
        core.markers[marker_id]=L.marker([marker.lat,marker.lon], { icon: new L.DivIcon({ html: marker_content }) });
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
            popup_content=popup_content+'<br>Bicycle stand: ';
            if (marker.info.bicycle_parking=='stands' || marker.info.bicycle_parking=='wide_stands') {
                popup_content=popup_content+'U type (safe)';
            } else if (marker.info.bicycle_parking=='rack' || marker.info.bicycle_parking=='racks') {
                popup_content=popup_content+'A type (safe)';
            } else if (marker.info.bicycle_parking=='shed') {
                popup_content=popup_content+'covered (safe)';
            } else if (marker.info.bicycle_parking=='informal') {
                popup_content=popup_content+'informal (railing etc.)';
            } else {
                popup_content=popup_content+'not suitable';
            }
        }
        if (marker.filename!=undefined && marker.filename) {
            popup_content=popup_content+'<br><a href="' + getFilename(marker.filename, false) + '" target="_blank"><img src="' + getFilename(marker.filename) + '" alt="' + marker.filename + '"></a>';
        }
        if (marker.relations!=undefined && marker.relations.length) {
            popup_content=popup_content+'<br>Path number: ';
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

function getFilename(filename, thumb = true) {
    // URL
    if (filename.indexOf('http://')!=-1 || filename.indexOf('https://')!=-1) {
        url = filename;
    } else {
        // file in storage
        path = 'storage/photos/thumbs/';
        if (!thumb) {
            path = 'storage/photos/';
        }
        url = core.storage_path+path+filename;
    }
    return url;
}

/*
                                    L.polyline([[48.0577198,17.1588219],[48.0572613,17.1594371],[48.0540635,17.1636517],[48.0532544,17.1647505],[48.0521715,17.1662553],[48.0515535,17.1673497],[48.0507836,17.1690633],[48.0504381,17.1701152],[48.0501549,17.1710317],[48.0499183,17.1721572],[48.0494866,17.1746782],[48.0493935,17.1752185],[48.0492204,17.1760066],[48.0485217,17.1810833],[48.0482257,17.1832456],[48.047979,17.1850308],[48.0476519,17.1865758],[48.047228,17.1882752],[48.0467338,17.1899404],[48.0463494,17.1908845],[48.0457433,17.1923093],[48.0448862,17.1940002],[48.0443762,17.194847],[48.0438643,17.1956712],[48.0434027,17.1963696],[48.0429581,17.1970643],[48.0423441,17.1978196],[48.041093,17.1993237],[48.0401748,17.2002503],[48.0394599,17.2007212],[48.0376191,17.2018523]], { className: 'path name-cunovska-radiala network-lcn operator-cyklokoalicia ref-r28 route-bicycle state-proposed type-route'}).bindPopup('<strong>Čunovská radiála</strong><br>Path number: R28<br>Operator: Cyklokoalícia<br>name=Čunovská radiála<br>network=lcn<br>operator=Cyklokoalícia<br>ref=R28<br>route=bicycle<br>state=proposed<br>type=route').setText('R28').addTo(layers.layer4);

                                    L.polyline([[48.1499778,17.0659268],[48.1500959,17.0655835],[48.1501299,17.0654595],[48.1501415,17.0654032],[48.1501559,17.0653321],[48.1502104,17.0651556]], { className: 'path highway-residential is_in-bratislava---karlova-ves lcn-yes maxspeed-30 source-maxspeed-sign'}).bindPopup('<br>highway=residential<br>is_in=Bratislava - Karlova Ves<br>lcn=yes<br>maxspeed=30<br>source:maxspeed=sign').addTo(layers.layer5);
*/