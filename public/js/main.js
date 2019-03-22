var base = L.tileLayer('//tile.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png?apikey=22dfe3fe43fe4b71870f0d767e697b76', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 20
});
var map = L.map('map', {
    center:  [48.1469961, 17.0969001],
    zoom:  15,
    layers: [base, roadsigns]
});
var baselayers = {
    "Base": base,
};
var overlays = {
    "Značky": roadsigns,
    "Fotky": photos,
    "Trasy": paths
};
L.control.layers(baselayers, overlays, {
    hideSingleBase: true
}).addTo(map);
markers.checkIn(roadsigns);
markers.checkIn(photos);
markers.addTo(map);
map.addLayer(roadsigns);