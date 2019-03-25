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
        @foreach (config('map.layers') as $layer_id=>$layer)
            @if ($layer['type']=='base')
                var base = L.tileLayer('{{$layer['url']}}', {
                    {!!Helper::jsGetOptions($layer['options'])!!}
                });
            @elseif ($layer['type']=='marker')
                @if (isset($layer['types']))
                    @foreach ($layer['types'] as $type_id=>$type)
                        var layer{{$layer_id}}_type{{$type_id}} = L.layerGroup();
                        @if (isset($type['cluster']) and $type['cluster']==true)
                            var clusters_layer{{$layer_id}}_type{{$type_id}} = L.markerClusterGroup.layerSupport({
                                {!!Helper::jsGetOptions($type['options'])!!}
                            });
                        @endif
                    @endforeach
                @else
                    var layer{{$layer_id}}_type0 = L.layerGroup();
                @endif
            @endif
        @endforeach
        @foreach ($markers as $id => $marker)
            {!!Helper::jsGetMarker($marker, $cycleways)!!}
        @endforeach
        var paths = L.layerGroup();
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
        var map = L.map('map', {
            center: [{{ config('map.center')[0] }},{{config('map.center')[1] }}],
            zoom: {{ config('map.zoom') }},
            layers: [
                @foreach (config('map.default_layers') as $layer)
                    {{$layer}}
                    @if (!$loop->last)
                        ,
                    @endif
                @endforeach
            ]
        });
        var baselayers = {
            'base': {{config('map.default_layers')[0]}},
        };
        var overlays = {
            "Trasy": paths,
            {!!Helper::jsGetOverlays()!!}
        };
        L.control.layers(baselayers, overlays, {
            hideSingleBase: true
        }).addTo(map);
        {!!Helper::jsSetupClusters()!!}
        @foreach (config('map.default_layers') as $layer)
            @if ($layer!='base')
                {{$layer}}.addTo(map);
                @if (!$loop->last)
                    ,
                @endif
            @endif
        @endforeach
    </script>
    <ascript src="{{ asset('js/main.js') }}"></script>
    </body>
</html>
