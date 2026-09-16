<!doctype html>
<html lang="{{config('map.language')}}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <meta name="robots" content="noindex">
        {{-- the page sits under /navigation/, the relative data/ URLs navigation.js fetches belong to the map's root --}}
        <base href="{{ url('/') }}/">
        <title>{{config('map.name')}} – navigation demo</title>
        <link rel="shortcut icon" href="{{asset('images/'.config('map.image'))}}"/>
        <link rel="stylesheet" href="{{asset('css/bootstrap.min.css')}}" />
        <link rel="stylesheet" href="{{asset('css/leaflet.css')}}" />
        <link rel="stylesheet" href="{{asset(config('map.stylesheet'))}}">
        <link rel="stylesheet" href="{{asset('css/navigation.css')}}?v={{filemtime(public_path('css/navigation.css'))}}">
        <style>
            html, body {
                height: 100%;
            }
            body {
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            #demo-controls {
                flex: 0 0 auto;
                padding: 0.5rem 0.75rem;
                border-bottom: 1px solid #dee2e6;
                background: #f8f9fa;
            }
            #demo-body {
                flex: 1 1 auto;
                display: flex;
                min-height: 0;
            }
            /* the map in a box of its own, which it fills; while following it is enlarged and turned inside it */
            #demo-map {
                flex: 1 1 auto;
                min-width: 0;
                position: relative;
                overflow: hidden;
            }
            #map {
                position: absolute;
                inset: 0;
            }
            #demo-side {
                flex: 0 0 24rem;
                display: flex;
                flex-direction: column;
                min-height: 0;
                border-left: 1px solid #dee2e6;
            }
            #sidebar-content {
                flex: 1 1 50%;
                overflow: auto;
                padding: 0.75rem;
                font-size: 0.9rem;
            }
            #demo-log {
                flex: 1 1 50%;
                overflow: auto;
                margin: 0;
                padding: 0.5rem 0.75rem;
                border-top: 1px solid #dee2e6;
                background: #212529;
                color: #f8f9fa;
                font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 0.8rem;
                white-space: pre-wrap;
            }
            #demo-log .demo-log-time {
                color: #adb5bd;
            }
            #demo-log .demo-log-chime {
                color: #ffc107;
            }
            #demo-log .demo-log-fix {
                color: #6c757d;
            }
            /* the red buttons as main.css darkens them on the map page, WCAG AAA */
            .btn-danger {
                color: #fff;
                background-color: #8b1a1a;
                border-color: #8b1a1a;
            }
            .btn-danger:hover, .btn-danger:focus {
                background-color: #6e1414;
                border-color: #6e1414;
            }
            .btn-outline-danger {
                color: #8b1a1a;
                border-color: #8b1a1a;
            }
            .btn-outline-danger:hover, .btn-outline-danger:focus {
                color: #fff;
                background-color: #8b1a1a;
            }
            /* the bar sits over the map, not over the side column */
            @media (min-width: 768px) {
                #navigation-follow {
                    right: 25rem;
                }
            }
            @media (max-width: 767.98px) {
                #demo-body {
                    flex-direction: column;
                }
                #demo-side {
                    flex: 0 0 40vh;
                    border-left: none;
                    border-top: 1px solid #dee2e6;
                }
            }
        </style>
    </head>
    <body>
        <form id="demo-controls" class="form-inline">
            <label class="sr-only" for="demo-link">Route link</label>
            <input type="text" class="form-control form-control-sm mr-2 mb-1" id="demo-link" style="width: 26rem; max-width: 100%;" placeholder="Paste a shared route link (…#n=…)">
            <button type="submit" class="btn btn-sm btn-primary mr-3 mb-1">Load route</button>
            <span class="mr-2 mb-1">Speed</span>
            <select id="demo-multiplier" class="form-control form-control-sm mr-3 mb-1">
                <option value="1">1× (real time)</option>
                <option value="2">2×</option>
                <option value="4" selected>4×</option>
                <option value="10">10×</option>
                <option value="30">30×</option>
            </select>
            <button type="button" class="btn btn-sm btn-outline-secondary mr-1 mb-1" id="demo-pause" disabled>Pause</button>
            <button type="button" class="btn btn-sm btn-outline-warning mr-1 mb-1" id="demo-detour" disabled>Leave the route</button>
            <button type="button" class="btn btn-sm btn-outline-secondary mr-1 mb-1" id="demo-back" disabled>← 100 m</button>
            <button type="button" class="btn btn-sm btn-outline-secondary mr-1 mb-1" id="demo-restart" disabled>Restart</button>
            <button type="button" class="btn btn-sm btn-outline-secondary mr-1 mb-1" id="demo-chimes">Test chimes</button>
            <span class="text-secondary ml-2 mb-1" id="demo-status"></span>
        </form>
        <div id="demo-body">
            <div id="demo-map"><div id="map"></div></div>
            <div id="demo-side">
                <div id="sidebar-content"></div>
                <pre id="demo-log"></pre>
            </div>
        </div>
        <script src="{{asset('js/leaflet.js')}}"></script>
        <script src="{{asset('js/i18n.min.js')}}"></script>
        <script src="{{asset('translations/'.config('map.language').'.js')}}"></script>
        <script src="{{asset('js/waynames.js')}}"></script>
        <script src="{{asset('js/guidance.js')}}?v={{filemtime(public_path('js/guidance.js'))}}"></script>
        <script src="{{asset('js/navigation.js')}}?v={{filemtime(public_path('js/navigation.js'))}}"></script>
        <script>
        i18n.translator.add(translation);
        var core = {config: {!! json_encode(config('map')) !!}};
        var base_layer = core.config.layers[0];
        var map = L.map('map', {
            center: core.config.center,
            zoom: core.config.zoom,
            zoomSnap: 0.5,
            zoomDelta: 0.5,
            layers: [L.tileLayer(base_layer.url, base_layer.options || {})]
        });
        L.control.scale({imperial: false}).addTo(map);

        // the panel navigation.js writes goes into the side column
        function openSidebar(content) {
            document.getElementById('sidebar-content').innerHTML = content;
        }
        function closeSidebar() {
            document.getElementById('sidebar-content').innerHTML = '';
        }

        var qs = function(selector) {
            return document.querySelector(selector);
        };
        var log = qs('#demo-log');
        var started_at = null;
        var last_fix = null;
        var source = null;
        var paused = false;

        function stamp() {
            var seconds = started_at == null ? 0 : Math.round((Date.now() - started_at) / 1000);
            var along = last_fix != null && last_fix.along != null ? Math.round(last_fix.along) + ' m' : '';
            return '<span class="demo-log-time">' + String(seconds).padStart(4, ' ') + 's ' + along.padStart(7, ' ') + '</span> ';
        }

        function write(html, cls) {
            var line = document.createElement('div');
            if (cls) {
                line.className = cls;
            }
            line.innerHTML = stamp() + html;
            log.appendChild(line);
            log.scrollTop = log.scrollHeight;
        }

        function escapeHtml(text) {
            return String(text).replace(/[&<>"']/g, function(character) {
                return '&#' + character.charCodeAt(0) + ';';
            });
        }

        function status(text) {
            qs('#demo-status').textContent = text || '';
        }

        function setButtons(following) {
            qs('#demo-pause').disabled = !following;
            qs('#demo-detour').disabled = !following;
            qs('#demo-back').disabled = !following;
            qs('#demo-restart').disabled = !following && !navigation.isFollowing();
        }

        navigation.init(map, core.config.navigation);

        navigation.on('route', function(result) {
            if (result.error) {
                write('route: <b>' + escapeHtml(result.error) + '</b>');
                status('No route: ' + result.error);
                return;
            }
            write('route: ' + Math.round(result.length) + ' m, ~' + Math.round(result.time / 60) + ' min, ' + result.steps.length + ' steps');
            if (!navigation.isFollowing()) {
                startDemo(result);
            }
        });

        navigation.on('announce', function(text, kind) {
            write('<span class="demo-log-chime">[' + escapeHtml(kind || '') + ']</span> 🔊 ' + escapeHtml(text));
        });

        navigation.on('fix', function(fix, event) {
            last_fix = fix;
            if (event == null) {
                return;
            }
            // one quiet line per step change, so the log stays readable
            if (event.step !== last_step || event.off_route !== last_off) {
                last_step = event.step;
                last_off = event.off_route;
                write('step ' + event.step + ' → next ' + event.next + ' in ' + Math.round(event.distance) + ' m' + (event.off_route ? ' <b>OFF ROUTE</b>' : ''), 'demo-log-fix');
            }
        });
        var last_step = null;
        var last_off = null;

        navigation.on('follow', function(following) {
            setButtons(following);
            if (!following) {
                status('Stopped');
            }
        });

        function startDemo(result) {
            started_at = Date.now();
            last_step = null;
            last_off = null;
            paused = false;
            qs('#demo-pause').textContent = 'Pause';
            source = guidance.fakeSource(result, {multiplier: parseFloat(qs('#demo-multiplier').value) || 1});
            if (navigation.startFollowing({source: source})) {
                status('Following at ' + qs('#demo-multiplier').value + '×');
            }
        }

        qs('#demo-controls').addEventListener('submit', function(e) {
            e.preventDefault();
            var link = qs('#demo-link').value.trim();
            log.innerHTML = '';
            if (!navigation.openLink(link)) {
                write('<b>Not a route link</b>: it needs #n=… as the share button writes it');
                status('Not a route link');
                return;
            }
            status('Finding the route…');
        });

        qs('#demo-multiplier').addEventListener('change', function() {
            if (source != null) {
                source.setMultiplier(parseFloat(this.value) || 1);
                status('Following at ' + this.value + '×');
            }
        });

        qs('#demo-pause').addEventListener('click', function() {
            if (source == null) {
                return;
            }
            paused = !paused;
            if (paused) {
                source.pause();
            } else {
                source.resume();
            }
            this.textContent = paused ? 'Resume' : 'Pause';
            write(paused ? 'paused' : 'resumed', 'demo-log-fix');
        });

        qs('#demo-detour').addEventListener('click', function() {
            if (source == null) {
                return;
            }
            // 60 m to the right of the route for a while, enough to be off it and get a new one
            source.setOffset(60);
            write('detour: 60 m right of the route for 20 s of ride time', 'demo-log-fix');
            var multiplier = parseFloat(qs('#demo-multiplier').value) || 1;
            window.setTimeout(function() {
                source.setOffset(0);
                write('detour over', 'demo-log-fix');
            }, 20000 / multiplier);
        });

        qs('#demo-back').addEventListener('click', function() {
            navigation.rewind(100);
            write('back 100 m', 'demo-log-fix');
        });

        qs('#demo-restart').addEventListener('click', function() {
            navigation.stopFollowing();
            var link = qs('#demo-link').value.trim();
            log.innerHTML = '';
            navigation.openLink(link);
        });

        qs('#demo-chimes').addEventListener('click', function() {
            var button = this;
            var Context = window.AudioContext || window.webkitAudioContext;
            if (Context == undefined) {
                write('no Web Audio in this browser');
                return;
            }
            // one at a time, with a pause between, so each can be heard on its own
            var kinds = ['turn', 'arrive', 'off_route'];
            var pause = 2500;
            button.disabled = true;
            kinds.forEach(function(kind, index) {
                window.setTimeout(function() {
                    write('<span class="demo-log-chime">[' + kind + ']</span> chime');
                    navigation.chime(kind);
                    if (index == kinds.length - 1) {
                        window.setTimeout(function() {
                            button.disabled = false;
                        }, pause);
                    }
                }, index * pause);
            });
        });

        // a link in the page's own address opens straight away
        if (window.location.hash.indexOf('n=') != -1) {
            qs('#demo-link').value = window.location.href;
            navigation.openLink(window.location.href);
        }
        </script>
    </body>
</html>
