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
        <title>{{config('map.name')}}</title>
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
        <script src="{{asset('js/leaflet.markercluster.layersupport.js')}}"></script>
        <script>
        var map_center=[{{ config('map.center')[0] }},{{ config('map.center')[1] }}];
        var map_zoom={{ config('map.zoom') }};
        var roadsigns = L.layerGroup();
        var photos = L.layerGroup();
        var developments = L.layerGroup();
        var paths = L.layerGroup();
        var clusters_roadsigns = L.markerClusterGroup.layerSupport({ disableClusteringAtZoom: 15 });
        var clusters_photos = L.markerClusterGroup.layerSupport({ disableClusteringAtZoom: 17 });
        @foreach ($markers as $id => $marker)
            L.marker([{{ $marker->lat }},{{ $marker->lon }}]
            @if ($marker->layer_id==1)
                @if ($marker->type==1)
                    ,{ icon: new L.DivIcon({ html: '<div class="roadsign'+
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
                    ,{ icon: new L.DivIcon({ html: '<div class="photo"><img src="{{ asset('storage/photos/thumbs/'.$marker->filename) }}"></div>' })
                @endif
            @elseif ($marker->layer_id==2)
                ,{ icon: new L.DivIcon({ html: '<div class="development"></div>' })
            @endif
            }).bindPopup(''
            @if ($marker->layer_id==1)
                @if ($marker->type==1)
                    +'Značka '
                @elseif ($marker->type==2)
                    +'Fotka '
                @endif
            @endif
                +'{{ $marker->name }}'
            @if ($marker->description)
                +'<br>{{$marker->description}}'
            @endif
            @if ($marker->filename)
                +'<a href="{{ asset('storage/photos/'.$marker->filename) }}" target="_blank"><img src="{{ asset('storage/photos/thumbs/'.$marker->filename) }}"></a>'
            @endif
            @if (isset($marker->relations) and count($marker->relations))
                +'<br>Číslo trasy: '
                @foreach ($marker->relations as $relation)
                     +'{{ $cycleways[$relation->cycleway_id]->sign }}'
                     @if (!$loop->last)
                        ,
                     @endif
                @endforeach
            @endif
            @if ($marker->note)
                +'<br>{{$marker->note}}'
            @endif
            ).addTo(
            @if ($marker->layer_id==1)
                @if ($marker->type==1)
                    roadsigns
                @elseif ($marker->type==2)
                    photos
                @endif
            @elseif ($marker->layer_id==2)
                developments
            @endif
            );
        @endforeach
        @if (count($paths))
            @foreach ($paths as $path)
                L.polyline([
                @foreach ($path['nodes'] as $node)
                    [{{$node[0]}},{{$node[1]}}]
                    @if (!$loop->last)
                        ,
                    @endif
                @endforeach
                ], {
                    @if (isset($path['info']['state']) and $path['info']['state']=='proposed')
                        color: 'red', weight: 3, dashArray: '8 8', opacity: 0.6
                    @else
                        color: 'blue', weight: 3
                    @endif
                })
                @if (isset($path['info']))
                    .bindPopup(
                @endif
                @if (isset($path['info']['name']))
                    '{{$path['info']['name']}}'+
                @endif
                @if (isset($path['info']['ref']))
                    '<br>Číslo trasy: {{$path['info']['ref']}}'+
                @endif
                @if (isset($path['info']['operator']))
                    '<br>Správca: {{$path['info']['operator']}}'+
                @endif
                @if (isset($path['info']))
                    @foreach ($path['info'] as $key=>$value)
                        '<br>{{$key}}={{$value}}'+
                    @endforeach
                @endif
                @if (isset($path['info']))
                    '')
                @endif
                .addTo(paths);
            @endforeach
        @endif
    </script>
    <script src="{{ asset('js/main.js') }}"></script>
    </body>
</html>
