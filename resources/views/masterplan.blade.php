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
        <title>{{config('map.name')}}</title>
        <link rel="shortcut icon" href="{{asset('images/'.config('map.image'))}}"/>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.4.0/css/bootstrap.min.css" integrity="sha256-/ykJw/wDxMa0AQhHDYfuMEwVb4JHMx9h4jD4XvHqVzU=" crossorigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.6.0/leaflet.css" integrity="sha256-SHMGCYmST46SoyGgo4YR/9AlK1vf3ff84Aq9yK4hdqM=" crossorigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/MarkerCluster.Default.css" integrity="sha256-LWhzWaQGZRsWFrrJxg+6Zn8TT84k0/trtiHBc6qcGpY=" crossorigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/MarkerCluster.Default.css" integrity="sha256-LWhzWaQGZRsWFrrJxg+6Zn8TT84k0/trtiHBc6qcGpY=" crossorigin="anonymous" />
        <link rel="stylesheet" href="{{ asset('css/main.css') }}">
        <link rel="canonical" href="{{secure_url('/')}}" />
        <meta name="description" content="{{substr(strip_tags(config('map.intro')),0,300)}}">
        <meta property="og:title" content="{{config('map.name')}}">
        <meta property="og:description" content="{{substr(strip_tags(config('map.intro')),0,255)}}">
        <meta property="og:image" content="{{asset('images/'.config('map.image'))}}">
        <meta property="og:url" content="{{secure_url('/')}}">
        <meta property="og:type" content="website">
        <meta name="twitter:title" content="{{config('map.name')}}">
        <meta name="twitter:description" content="{{substr(strip_tags(config('map.intro')),0,150)}}">
        <meta name="twitter:image" content="{{ asset('images/'.config('map.image')) }}">
        <meta name="twitter:card" content="summary_large_image">
    </head>
    <body>
        <!-- Google Tag Manager (noscript) -->
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{config('google.GTM_ID')}}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
        <!-- End Google Tag Manager (noscript) -->
        <div id="map"></div>
        <!-- jQuery first, then Popper.js, then Bootstrap JS -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js" integrity="sha256-CSXorXvZcTkaix6Yvo6HppcZGetbYMGWSFlBw8HfCJo=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.16.1/popper.min.js" integrity="sha256-O17BxFKtTt1tzzlkcYwgONw4K59H+r1iI8mSQXvSf5k=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.4.0/js/bootstrap.min.js" integrity="sha256-oKpAiD7qu3bXrWRVxnXLV1h7FlNV+p5YJBIr8LOCFYw=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.6.0/leaflet.js" integrity="sha256-fNoRrwkP2GuYPbNSJmMJOCyfRB2DhPQe0rGTgzRsyso=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.4.1/leaflet.markercluster.js" integrity="sha256-WL6HHfYfbFEkZOFdsJQeY7lJG/E5airjvqbznghUzRw=" crossorigin="anonymous"></script>
        <script src="{{asset('js/leaflet.markercluster.layersupport.js')}}"></script>
        <script src="{{asset('js/leaflet.textpath.js')}}"></script>
        <script src="{{asset('js/i18n.min.js')}}"></script>
        <script src="{{asset('translations/'.config('map.language').'.js')}}"></script>
        <script src="{{asset('js/main.js')}}"></script>
        <script>
        i18n.translator.add(translation);
        core.config={!! json_encode(config('map')) !!};
        core.editable_layer_id=getEditableLayerId();
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
        if (!getCookie('intro_off')) {
            core.options.intro = L.popup({ closeButton: true, autoClose: true, minWidth: core.options.popup_width}).setLatLng(map.getBounds().getCenter()).setContent('{!! addslashes(config('map.intro')) !!}').openOn(map);
        }
        {!!Helper::jsSetupClusters()!!}
    </script>
    <div id="form" class="d-none">
        {!! form($form) !!}
    </div>
    </body>
</html>
