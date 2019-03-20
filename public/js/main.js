var map = L.map('map').setView([48.1471393, 17.0969001], 15);
L.tileLayer('//tile.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png?apikey=22dfe3fe43fe4b71870f0d767e697b76', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
}).addTo(map);