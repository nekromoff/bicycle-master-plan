var layers=[];
var options=[];

$(document).ready(function() {
    // if location fragment exists on launch
    if (window.location.hash) {
        map.closePopup(intro);
        setupMap();
    }
    map.on('moveend', rewriteFragment);
    map.on('zoomend', rewriteFragment);
    map.on('overlayadd', rewriteFragment);
    map.on('overlayremove', rewriteFragment);
});

function initializeOptions() {
    if (window.location.hash) {
        parts=window.location.hash.replace('#','').split('|')
        parts.forEach(function(part) {
            if (part.indexOf('l')!=-1) {
                options.layers_found=part.replace('l','').split(',');
            }
            if (part.indexOf('z')!=-1) {
                options.zoom=part.replace('z','');
            }
            if (part.indexOf('c')!=-1) {
                center=part.replace('c','');
                options.center=center.split(',');
            }
        });
    }
}

function setupMap() {
    parts=window.location.hash.replace('#','').split('|')
    parts.forEach(function(part) {
        if (part.indexOf('l')!=-1) {
            options.layers_found=part.replace('l','').split(',');
            toggleLayers(options.layers_found);
        }
        if (part.indexOf('z')!=-1) {
            options.zoom=part.replace('z','');
            map.setZoom(options.zoom);
        }
        if (part.indexOf('c')!=-1) {
            center=part.replace('c','');
            options.center=center.split(',');
            options.center['lat']=options.center[0];
            options.center['lng']=options.center[1];
            options.center[0]=undefined;
            options.center[1]=undefined;
            map.setView([options.center['lat'],options.center['lng']], options.zoom);
        }
    });
}

function toggleLayers(layers_found) {
    for (layer in layers) {
        layer_id=getLayerId(layer);
        if (map.hasLayer(layers[layer]) && layers_found.indexOf(layer_id)==-1) {
            map.removeLayer(layers[layer]);
        }
        if (!map.hasLayer(layers[layer]) && layers_found.indexOf(layer_id)!=-1) {
            map.addLayer(layers[layer]);
        }
    }
}

function rewriteFragment() {
    fragment='';
    layers_enabled=[];
    for (layer in layers) {
        if (map.hasLayer(layers[layer])) {
            layer_id=getLayerId(layer);
            layers_enabled.push(layer_id);
        }
    }
    fragment=fragment+'l'+layers_enabled.join(',');
    fragment=fragment+'|z'+map.getZoom();
    options.center=map.getCenter();
    fragment=fragment+'|c'+options.center['lat'].toFixed(5)+','+options.center['lng'].toFixed(5);
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