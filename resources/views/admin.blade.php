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
        <link rel="stylesheet" href="{{ asset('css/admin.css') }}">
    </head>
    <body>
        <!-- Google Tag Manager (noscript) -->
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{config('google.GTM_ID')}}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
        <!-- End Google Tag Manager (noscript) -->
        <!-- jQuery first, then Popper.js, then Bootstrap JS -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js" integrity="sha256-CSXorXvZcTkaix6Yvo6HppcZGetbYMGWSFlBw8HfCJo=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.16.1/popper.min.js" integrity="sha256-O17BxFKtTt1tzzlkcYwgONw4K59H+r1iI8mSQXvSf5k=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.4.0/js/bootstrap.min.js" integrity="sha256-oKpAiD7qu3bXrWRVxnXLV1h7FlNV+p5YJBIr8LOCFYw=" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.6.0/leaflet.js" integrity="sha256-fNoRrwkP2GuYPbNSJmMJOCyfRB2DhPQe0rGTgzRsyso=" crossorigin="anonymous"></script>
        <script src="https://cdn.jsdelivr.net/npm/leaflet-easybutton@2/src/easy-button.js"></script>
        <script src="{{asset('js/i18n.min.js')}}"></script>
        <script src="{{asset('translations/'.config('map.language').'.js')}}"></script>
        <div class="container-fluid">
            <div class="row">
                <div class="col-md">
                    <ul class="nav">
                        <li class="nav-item">
                            <a class="nav-link" href="{{route('map')}}">Map</a>
                        </li>
                    </ul>
                </div>
            </div>
            <div class="row">
                <div class="col-md">
                    <div id="map"></div>
                </div>
                <div class="col-md">
                    <h2>Submitted</h2>
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th scope="col">Type</th>
                                <th scope="col">Reporting date</th>
                                <th scope="col">Name</th>
                                <th scope="col">Description</th>
                                <th scope="col">Photo</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($markers['submitted'] as $marker)
                                <tr data-lat="{{$marker->lat}}" data-lon="{{$marker->lon}}">
                                    <td>{{$editable_types[$marker->type]['name']}}</td>
                                    <td>{{$marker->created_at->format('Y-m-d')}}</td>
                                    <td><a href="{{secure_url('/').'#l'.$editable_layer_id.'|z'.config('map.layers')[0]['options']['maxZoom'].'|c'.$marker->lat.','.$marker->lon}}">{{$marker->name}}</a></td>
                                    <td>{{$marker->description}}
                                        @if ($marker->url)
                                            <br><a href="{{$url}}">{{$url}}</a>
                                        @endif
                                    </td>
                                    <td>@if ($marker->filename)
                                            <a href="{{Helper::getFilename($marker->layer_id, $marker->filename, false)}}" target="_blank"><img src="{{Helper::getFilename($marker->layer_id, $marker->filename, false)}}" class="img-fluid" alt="{{$marker->name}}"></a>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                    <h2>Outdated</h2>
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th scope="col">Type</th>
                                <th scope="col">Reporting date</th>
                                <th scope="col">Name</th>
                                <th scope="col">Description</th>
                                <th scope="col">Photo</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($markers['outdated'] as $marker)
                                <tr data-lat="{{$marker->lat}}" data-lon="{{$marker->lon}}">
                                    <td>{{$editable_types[$marker->type]['name']}}</td>
                                    <td>{{$marker->created_at->format('Y-m-d')}}</td>
                                    <td><a href="{{secure_url('/').'#l'.$editable_layer_id.'|z'.config('map.layers')[0]['options']['maxZoom'].'|c'.$marker->lat.','.$marker->lon}}">{{$marker->name}}</a></td>
                                    <td>{{$marker->description}}
                                        @if ($marker->url)
                                            <br><a href="{{$url}}">{{$url}}</a>
                                        @endif
                                    </td>
                                    <td>@if ($marker->filename)
                                            <a href="{{Helper::getFilename($marker->layer_id, $marker->filename, false)}}" target="_blank"><img src="{{Helper::getFilename($marker->layer_id, $marker->filename, false)}}" class="img-fluid" alt="{{$marker->name}}"></a>
                                        @endif
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <script>
            i18n.translator.add(translation);
            var core = {};
            core.options = [];
            core.config={!! json_encode(config('map')) !!};
            core.storage_path='{{asset('...')}}'.replace('...','');
            core.options.zoom={{ config('map.zoom') }};
            core.options.center=[{{ config('map.center')[0] }},{{config('map.center')[1] }}];
            var base = L.tileLayer('{{config('map.layers')[0]['url']}}', {
                    {!!Helper::jsGetOptions(config('map.layers')[0]['options'])!!}
                });
            var map = L.map('map', {
                center: core.options.center,
                zoom: core.options.zoom,
                layers: [
                    {{config('map.default_layers')[0]}}
                ]
            });
            var baselayers = {
                'base': {{config('map.default_layers')[0]}}
            };
            L.control.scale({imperial: false}).addTo(map);
            map.setView([core.options.center[0], core.options.center[1]], core.options.zoom);
            var marker;
            $('tbody tr').on('mouseover', function() {
                if ($(this).attr('data-lat')) {
                    coords=[$(this).attr('data-lat'), $(this).attr('data-lon')];
                    marker = L.marker(coords);
                    marker.addTo(map);
                    map.setView(coords);
                }
            });
            $('tbody tr').on('mouseout', function() {
                map.removeLayer(marker);
            });
        </script>
    </body>
</html>