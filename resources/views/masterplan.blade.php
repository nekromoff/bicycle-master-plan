<!doctype html>
<html lang="en">
    <head>
        <!-- Google Tag Manager -->
        <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','{{config(google.GTM_ID)}}');</script>
        <!-- End Google Tag Manager -->
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
        <!-- Google Tag Manager (noscript) -->
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{config(google.GTM_ID)}}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
        <!-- End Google Tag Manager (noscript) -->
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
            @elseif ($layer['type']=='path')
                @if (isset($layer['types']))
                    @foreach ($layer['types'] as $type_id=>$type)
                        var layerpath{{$layer_id}}_type{{$type_id}} = L.layerGroup();
                    @endforeach
                @else
                    var layerpath{{$layer_id}}_type0 = L.layerGroup();
                @endif
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
        @foreach ($paths as $path)
            {!!Helper::jsGetPath($path)!!}
        @endforeach
        @foreach ($markers as $id => $marker)
            {!!Helper::jsGetMarker($marker, $cycleways)!!}
        @endforeach
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
            'base': {{config('map.default_layers')[0]}}
        };
        var overlays = {
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
    </body>
</html>
