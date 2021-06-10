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
        <link rel="stylesheet" href="{{asset('css/bootstrap.min.css')}}" />
        <link rel="stylesheet" href="{{asset('css/leaflet.css')}}" />
        <link rel="stylesheet" href="{{asset('css/easy-button.css')}}" />
        <link rel="stylesheet" href="{{ asset('css/admin.css') }}">
    </head>
    <body>
        <!-- Google Tag Manager (noscript) -->
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id={{config('google.GTM_ID')}}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
        <!-- End Google Tag Manager (noscript) -->
        <script src="{{asset('js/jquery-3.5.1.min.js')}}"></script>
        <script src="{{asset('js/bootstrap.bundle.min.js')}}"></script>
        <script src="{{asset('js/leaflet.js')}}"></script>
        <script src="{{asset('js/easy-button.js')}}"></script>
        <script src="{{asset('js/i18n.min.js')}}"></script>
        <script src="{{asset('translations/'.config('map.language').'.js')}}"></script>
        <div class="container-fluid">
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
                            @if (isset($markers['submitted']))
                                @foreach($markers['submitted'] as $marker)
                                    <tr data-lat="{{$marker->lat}}" data-lon="{{$marker->lon}}">
                                        <td>{{$editable_types[$marker->type]['name']}}</td>
                                        <td>{{$marker->created_at->format('Y-m-d')}}</td>
                                        <td><a href="{{secure_url('/').'#l'.$editable_layer_id.'|z'.config('map.layers')[0]['options']['maxZoom'].'|c'.$marker->lat.','.$marker->lon.'|m'.$marker->id}}">{{$marker->name}}</a></td>
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
                            @endif
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
                            @if (isset($markers['outdated']))
                                @foreach($markers['outdated'] as $marker)
                                    <tr data-lat="{{$marker->lat}}" data-lon="{{$marker->lon}}">
                                        <td>{{$editable_types[$marker->type]['name']}}</td>
                                        <td>{{$marker->created_at->format('Y-m-d')}}</td>
                                        <td><a href="{{secure_url('/').'#l'.$editable_layer_id.'|z'.config('map.layers')[0]['options']['maxZoom'].'|c'.$marker->lat.','.$marker->lon.'|m'.$marker->id}}">{{$marker->name}}</a></td>
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
                            @endif
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
            L.easyButton('<span data-toggle="tooltip" data-placement="top" title="'+ i18n("Map")+'">↑</span>', function() { window.location.assign("{{route('map')}}") }).addTo(map);
        </script>
    </body>
</html>
