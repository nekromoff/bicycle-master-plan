<!doctype html>
<html lang="en">
    <head>
        <!-- Google Tag Manager -->
        <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','{{config('google.GTM_ID')}}');</script>
        <!-- End Google Tag Manager -->
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"
  integrity="sha512-xwE/Az9zrjBIphAcBb3F6JVqxf46+CDLwfLMHloNu6KEQCAWi6HcDUbeOfBIptF7tcCzusKFjFw2yuvEpDL9wQ=="
  crossorigin=""/>
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css">
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css">
        <link rel="stylesheet" href="{{ asset('css/main.css') }}">
        <title>{{config('map.name')}}</title>
    </head>
    <body>
        <!-- Google Tag Manager (noscript) -->
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{config('google.GTM_ID')}}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
        <!-- End Google Tag Manager (noscript) -->
        <div id="map"></div>
        <!-- jQuery first, then Popper.js, then Bootstrap JS -->
        <script src="https://code.jquery.com/jquery-3.4.1.min.js" integrity="sha256-CSXorXvZcTkaix6Yvo6HppcZGetbYMGWSFlBw8HfCJo=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
        <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
        <script src="https://unpkg.com/leaflet@1.6.0/dist/leaflet.js" integrity="sha512-gZwIG9x3wUXg2hdXF6+rVkLF/0Vi9U8D2Ntg4Ga5I5BZpVkVxlJWbSQtXPSiUTtC0TjtGOmxa1AJPuV0CPthew==" crossorigin=""></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
        <script src="{{asset('js/leaflet.markercluster.layersupport.js')}}"></script>
        <script src="{{asset('js/leaflet.textpath.js')}}"></script>
        <script src="{{asset('js/main.js')}}"></script>
        <script>
        core.config={!! json_encode(config('map')) !!};
        core.storage_path='{{asset('...')}}'.replace('...','');
        @foreach (config('map.layers') as $layer_id=>$layer)
            @if ($layer['type']=='base')
                var base = L.tileLayer('{{$layer['url']}}', {
                    {!!Helper::jsGetOptions($layer['options'])!!}
                });
            @elseif ($layer['type']=='path')
                @if (isset($layer['types']))
                    @foreach ($layer['types'] as $type_id=>$type)
                        core.layers.layer{{$layer_id}}_type{{$type_id}} = L.layerGroup();
                    @endforeach
                @else
                    core.layers.layer{{$layer_id}} = L.layerGroup();
                @endif
            @elseif ($layer['type']=='combined')
                core.layers.layer{{$layer_id}} = L.layerGroup();
            @elseif ($layer['type']=='marker')
                @if (isset($layer['types']))
                    @foreach ($layer['types'] as $type_id=>$type)
                        core.layers.layer{{$layer_id}}_type{{$type_id}} = L.layerGroup();
                        @if (isset($type['cluster']) and $type['cluster']==true)
                            core.clusters.layer{{$layer_id}}_type{{$type_id}} = L.markerClusterGroup.layerSupport({
                                {!!Helper::jsGetOptions($type['options'])!!}
                            });
                        @endif
                    @endforeach
                @else
                    core.layers.layer{{$layer_id}} = L.layerGroup();
                @endif
            @endif
        @endforeach
<?php
/*
@foreach ($paths as $path)
{!!Helper::jsGetPath($path)!!}
@endforeach
@foreach ($markers as $id => $marker)
{!!Helper::jsGetMarker($marker, $cycleways)!!}
@endforeach
 */
;?>
        core.options.zoom={{ config('map.zoom') }};
        core.options.center=[{{ config('map.center')[0] }},{{config('map.center')[1] }}];
        forceOptions();
        var map = L.map('map', {
            center: core.options.center,
            zoom: core.options.zoom,
            layers: [
                @foreach (config('map.default_layers') as $layer)
                    @if ($layer!='base')
                        core.layers.layer{{$layer}}
                    @else
                        {{$layer}}
                    @endif
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
        L.control.scale({imperial: false}).addTo(map);
        var intro = L.popup({
            closeButton: true,
            autoClose: true
        }).setLatLng(map.getBounds().getCenter()).setContent('{!! addslashes(config('map.intro')) !!}').openOn(map);
        {!!Helper::jsSetupClusters()!!}
    </script>
    </body>
</html>
