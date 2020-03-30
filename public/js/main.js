$(document).ready(function() {
    // if location fragment exists on launch
    if (window.location.hash) {
        map.closePopup(intro);
        refreshMap();
    }
    map.on('moveend', rewriteFragment);
    map.on('zoomend', rewriteFragment);
    //map.on('layeradd', rewriteFragment);
    //map.on('layerremove', rewriteFragment);
});

function refreshMap() {
    parts=window.location.hash.replace('#','').split('|')
    parts.forEach(function(part) {
        if (part.indexOf('l')!=-1) {
            layers_found=part.replace('l','').split(',');
            toggleLayers(layers_found);
        }
        if (part.indexOf('z')!=-1) {
            zoom=part.replace('z','');
            map.setZoom(zoom);
        }
        if (part.indexOf('c')!=-1) {
            center=part.replace('c','');
            coords=center.split(',');
            map.setView([coords[0],coords[1]], map.getZoom());
        }
    });
}

function toggleLayers(layers_found) {
    layers.forEach(function(layer) {
        map.removeLayer(layer);
    });
    layers_found.forEach(function(layer) {
        layer_id=layer;
        if (layers[layer_id]!=undefined) {
            map.addLayer(layers[layer_id]);
        }
    })
}

function rewriteFragment() {
    fragment=window.location.hash.replace('#','');
    // console.log(fragment);
    // if (fragment.indexOf('l')!=-1) {
    //     layers_enabled=[];
    //     layers.forEach(function(layer, layer_id) {
    //         if (map.hasLayer(layer)) {
    //             layers_enabled.push(layer_id);
    //         }
    //     });
    //     console.log(layers_enabled);
    //     //fragment=fragment.replace(/\|l([0-9]+\,?){1,}|/g,'|l'+layers_enabled.join(','))
    // } else {
    //     layers_enabled=[];
    //     layers.forEach(function(layer, layer_id) {
    //         if (map.hasLayer(layer)) {
    //             layers_enabled.push(layer_id);
    //         }
    //     });
    //     fragment=fragment+'|l'+layers_enabled.join(',');
    // }
    console.log('after l: '+fragment);
    if (fragment.indexOf('z')!=-1) {
        fragment=fragment.replace(/\|z[0-9]{1,2}/g,'\|z'+map.getZoom());
    } else {
        fragment=fragment+'|z'+map.getZoom();
    }
    console.log('after z: '+fragment);
    if (fragment.indexOf('c')!=-1) {
        center=map.getCenter();
        fragment=fragment.replace(/\|c[0-9.]{1,20},[0-9.]{1,20}/g,'|c'+center['lat'].toFixed(5)+','+center['lng'].toFixed(5));
    } else {
        center=map.getCenter();
        fragment=fragment+'|c'+center['lat'].toFixed(5)+','+center['lng'].toFixed(5);
    }
    console.log('after c: '+fragment);
    window.location.hash=fragment;
}