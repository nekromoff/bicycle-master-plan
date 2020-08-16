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
        <div class="container">
            <div class="row">
                <div class="col-md">
                    <table class="table">
                        <thead>
                            <tr>
                                <th scope="col">Type</th>
                                <th scope="col">Reporting date</th>
                                <th scope="col">Name</th>
                                <th scope="col">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($markers as $marker)
                                <tr>
                                    <td>{{$editable_types[$marker->type]['name']}}</td>
                                    <td>{{$marker->created_at->format('Y-m-d')}}</td>
                                    <td><a href="{{secure_url('/').'#l'.$editable_layer_id.'|z'.config('map.layers')[0]['options']['maxZoom'].'|c'.$marker->lat.','.$marker->lon}}">{{$marker->name}}</a></td>
                                    <td>{{$marker->description}}<br>
                                        <img src="{{Helper::getFilename($marker->layer_id, $marker->filename, false)}}" width="200px" alt="{{$marker->name}}">
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </body>
</html>
