console.log('here ');
var map = L.map('map', {
    center: map_center,
    zoom: map_zoom,
    layers: [base, roadsigns]
});
var baselayers = {
    "Base": base,
};
var overlays = {
    "Značky": roadsigns,
    "Fotky": photos,
    "Trasy": paths,
    "EIA projekty": developments
};
L.control.layers(baselayers, overlays, {
    hideSingleBase: true
}).addTo(map);
clusters_roadsigns.checkIn(roadsigns);
clusters_photos.checkIn(photos);
clusters_roadsigns.addTo(map);
clusters_photos.addTo(map);
map.addLayer(roadsigns);