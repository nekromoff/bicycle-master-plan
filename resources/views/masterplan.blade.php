<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.4.0/dist/leaflet.css" integrity="sha512-puBpdR0798OZvTTbP4A8Ix/l+A4dHDD0DGqYW6RQ+9jxkRFclaxxQb/SJAWZfWAkuyeQUytO7+7N4QKrDh+drA==" crossorigin=""/>
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css">
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css">
        <link rel="stylesheet" href="{{ asset('css/main.css') }}">
        <title>Pasport cyklotrás, Bratislava</title>
    </head>
    <body>
        <div id="map"></div>
        <!-- Optional JavaScript -->
        <!-- jQuery first, then Popper.js, then Bootstrap JS -->
        <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
        <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
        <script src="https://unpkg.com/leaflet@1.4.0/dist/leaflet.js"
       integrity="sha512-QVftwZFqvtRNi0ZyCtsznlKSWOStnDORoefr1enyq5mVL4tmKB3S/EnC3rRJcxCPavG10IcrVGSmPh6Qw5lwrg=="
       crossorigin=""></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
        <script src="{{ asset('js/main.js') }}"></script>
        <script>
        var markers = L.markerClusterGroup({ disableClusteringAtZoom: 15 });
        @foreach ($markers as $id => $marker)
            markers.addLayer(L.marker([{{ $marker->lat }},{{ $marker->lon }}]
            @if ($marker->type==1)
                ,{ icon: new L.DivIcon({
                    html: '<div class="roadsign'+
                @if ($marker->name[0] == 'B')
                    ' b'
                @elseif ($marker->name[0] == 'C')
                    ' c'
                @elseif ($marker->name[0] == 'E')
                    ' e'
                @elseif (stripos($marker->name, 'IP') !== false)
                    ' ip'
                @elseif (stripos($marker->name, 'IP') !== false)
                    ' is'
                @endif
                @if (stripos($marker->name, 'X') !== false)
                    +' x'
                @endif
                +'">{{ str_replace('X', '', $marker->name) }}</div>' })
            @elseif ($marker->type==2)
                ,{ icon: new L.DivIcon({
                    html: '<div class="photo"><img src="../storage/app/photos/thumbs/{{$marker->filename}}"></div>' })
            @endif
            }).addTo(map).bindPopup(
                'Značka {{ $marker->name }}'
            @if ($marker->filename)
                +'<a href="../storage/app/photos/{{$marker->filename}}" target="_blank"><img src="../storage/app/photos/thumbs/{{$marker->filename}}"></a>'
            @endif
            @if (isset($marker->relations) and count($marker->relations))
                +'<br>Číslo trasy: '
                @foreach ($marker->relations as $relation)
                     +'{{ $cycleways[$relation->cycleway_id]->sign }}'
                @endforeach
            @endif
            @if ($marker->note)
                +'<br>{{$marker->note}}'
            @endif
            ));
        @endforeach
        map.addLayer(markers);
    </script>
    </body>
</html>
