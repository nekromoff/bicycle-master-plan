/*
    Point A to point B navigation over the paths of one layer.

    Optional: the page loads this file and calls navigation.init() only when
    map.navigation is configured, and main.js knows nothing about it. It fetches the
    layer on its own (the same, cached URL main.js uses), so the layer does not have
    to be switched on for routing to work.

    The router part has no Leaflet dependency - buildGraph() and route() are plain
    functions from paths to a result, so they can be run and tested outside the page.

    Scoring: every way gets a cost per metre. The first matching rule sets it, every
    matching modifier multiplies it. A factor of false makes the way impassable.
    Match values: a string (equals), a list (any of), true (tag present), false (tag
    absent). Keys starting with side: match the cycling channels the server resolved
    on path.sides, e.g. side:form => ['lane', 'track'].

    OSM ways often end a few metres short of each other, or meet a road that is not
    part of the layer. Such gaps are bridged with straight links that cost gap_factor
    per metre, drawn dashed, and reported, so the route shows where the network breaks.
    A way matching no_gaps (a bridge) only takes such links at its first and last
    point, otherwise the route would jump between the deck and the street below.
*/

var navigation = (function() {

    var DEFAULTS = {
        layer: 5,
        // km/h
        speed: 13,
        walking_speed: 4,
        respect_oneway: true,
        // metres a clicked point may be away from the nearest path
        snap_distance: 250,
        // unconnected paths closer than this many metres get linked
        gap_distance: 60,
        gap_factor: 4,
        // the entry of the layer's legend (its swatch class) each kind of stretch of a route is shown as
        legend: {
            separated: 'cycleway-lane',
            traffic: 'cycleway-shared_lane',
            recommended: 'lcn-provisional',
            footway: 'highway-pedestrian',
            mtb: 'mtb-scale'
        },
        // ways that gaps may only be bridged to at their first and last point
        no_gaps: [
            {match: {bridge: ['yes', 'viaduct', 'boardwalk', 'cantilever', 'covered', 'movable', 'trestle', 'suspension', 'aqueduct']}}
        ],
        // factor for a way no rule matched
        default_factor: 1.5,
        // what every stretch in traffic (orange) costs extra while separated routes are preferred
        prefer_separated_factor: 2.5,
        // spatial index cell, metres
        cell: 50,
        rules: [
            {match: {highway: ['construction', 'proposed']}, factor: false},
            {match: {highway: 'steps'}, factor: 5, walk: true},
            {match: {highway: 'cycleway'}, factor: 1, infrastructure: true},
            // after the cycleway rule: what the map draws as a cycle path is ridden, whatever bicycle=dismount says
            {match: {bicycle: 'dismount'}, factor: 3.5, walk: true},
            {match: {bicycle: 'designated'}, factor: 1, infrastructure: true},
            {match: {'side:form': ['track', 'lane', 'opposite_lane', 'opposite_track', 'sidepath']}, factor: 1.1, infrastructure: true},
            {match: {railway: 'tram'}, factor: 1.6},
            {match: {'side:form': ['shared_lane', 'share_busway', 'shared_busway', 'opposite', 'shoulder']}, factor: 1.3},
            {match: {lcn: true}, factor: 1.3},
            {match: {highway: ['pedestrian', 'footway', 'path'], bicycle: false}, factor: 1.7},
            {match: {highway: ['pedestrian', 'footway', 'path']}, factor: 1.5},
            {match: {}, factor: 1.5}
        ],
        modifiers: [
            {match: {surface: ['unpaved', 'ground', 'dirt', 'earth', 'grass', 'mud', 'sand', 'gravel', 'fine_gravel', 'compacted', 'pebblestone', 'woodchips']}, factor: 1.5},
            {match: {'mtb:scale': true}, factor: 1.5}
        ],
        // osm_data file of ordinary roads served by data/navigation, null to route over the layer alone
        support: null,
        // rules and modifiers for those roads
        support_rules: [
            {match: {highway: ['motorway', 'motorway_link', 'trunk', 'trunk_link']}, factor: false},
            {match: {motorroad: 'yes'}, factor: false},
            {match: {bicycle: ['no', 'use_sidepath', 'private']}, factor: false},
            {match: {access: ['private', 'no'], bicycle: false}, factor: false},
            {match: {vehicle: ['no', 'private'], bicycle: false}, factor: false},
            // fast arterials like Einsteinova
            {match: {highway: ['primary', 'primary_link', 'secondary', 'secondary_link'], maxspeed: ['60', '70', '80', '90', '100', '110', '120', '130']}, factor: false},
            {match: {highway: ['primary', 'primary_link', 'secondary', 'secondary_link'], foot: 'no'}, factor: false},
            {match: {highway: ['primary', 'primary_link'], foot: 'use_sidepath', maxspeed: false}, factor: false},
            {match: {bicycle: 'dismount'}, factor: 3.5, walk: true},
            // footpaths: walked unless cycling is allowed
            {match: {highway: 'steps'}, factor: 5, walk: true},
            {match: {highway: 'cycleway'}, factor: 1, infrastructure: true},
            {match: {highway: ['footway', 'pedestrian', 'path', 'bridleway'], bicycle: ['yes', 'designated', 'permissive']}, factor: 1.5},
            {match: {highway: 'path'}, factor: 2},
            {match: {highway: ['footway', 'pedestrian', 'bridleway']}, factor: 3.5, walk: true},
            // a road closed to motor vehicles: no traffic, ridden like a footway that allows cycling
            {match: {motor_vehicle: 'no'}, factor: 1.5},
            {match: {highway: 'living_street'}, factor: 1.5},
            {match: {highway: 'residential'}, factor: 2},
            {match: {highway: ['service', 'unclassified', 'track', 'road', 'tertiary', 'tertiary_link']}, factor: 2.5},
            {match: {highway: ['secondary', 'secondary_link']}, factor: 3.5},
            {match: {highway: ['primary', 'primary_link']}, factor: 5},
            {match: {}, factor: 3}
        ],
        support_modifiers: [
            {match: {maxspeed: ['60', '70', '80', '90']}, factor: 1.5},
            {match: {surface: ['unpaved', 'ground', 'dirt', 'earth', 'grass', 'mud', 'sand', 'gravel', 'fine_gravel', 'compacted', 'pebblestone', 'woodchips']}, factor: 1.5}
        ]
    };

    function withDefaults(config) {
        var merged = {};
        var key;
        for (key in DEFAULTS) {
            merged[key] = DEFAULTS[key];
        }
        for (key in (config || {})) {
            if (config[key] !== null && config[key] !== undefined) {
                merged[key] = config[key];
            }
        }
        return merged;
    }

    /* ---------- scoring ---------- */

    function channelValues(sides, channel) {
        var values = [];
        (sides || []).forEach(function(side) {
            if (side.channels != undefined && side.channels[channel] != undefined && side.channels[channel] !== false && side.channels[channel] != 'none') {
                values.push(String(side.channels[channel]));
            }
        });
        return values;
    }

    function matches(match, tags, sides) {
        for (var key in match) {
            var expected = match[key];
            var values;
            if (key.indexOf('side:') === 0) {
                values = channelValues(sides, key.slice(5));
            } else {
                values = tags[key] == undefined ? [] : [String(tags[key])];
            }
            if (expected === true) {
                if (!values.length) {
                    return false;
                }
            } else if (expected === false || expected === null) {
                if (values.length) {
                    return false;
                }
            } else {
                var list = Array.isArray(expected) ? expected.map(String) : [String(expected)];
                if (!values.some(function(value) { return list.indexOf(value) != -1; })) {
                    return false;
                }
            }
        }
        return true;
    }

    /*
        @return object|null {factor, walk, infrastructure}, null when the way cannot be used
    */
    function score(tags, sides, config) {
        var rule = null;
        for (var i = 0; i < (config.rules || []).length; i++) {
            if (matches(config.rules[i].match || {}, tags, sides)) {
                rule = config.rules[i];
                break;
            }
        }
        var result = {
            factor: rule ? rule.factor : config.default_factor,
            walk: !!(rule && rule.walk),
            infrastructure: !!(rule && rule.infrastructure)
        };
        if (result.factor === false || result.factor === null || !(result.factor > 0)) {
            return null;
        }
        for (var j = 0; j < (config.modifiers || []).length; j++) {
            var modifier = config.modifiers[j];
            if (!matches(modifier.match || {}, tags, sides)) {
                continue;
            }
            if (modifier.factor === false) {
                return null;
            }
            if (modifier.factor > 0) {
                result.factor = result.factor * modifier.factor;
            }
            if (modifier.walk) {
                result.walk = true;
            }
        }
        return result;
    }

    /* which way along the way (node order) a bicycle may go */
    function directions(tags, sides, respect_oneway) {
        if (!respect_oneway) {
            return {forward: true, backward: true};
        }
        var oneway = tags.oneway;
        if (tags.junction == 'roundabout' && oneway == undefined) {
            oneway = 'yes';
        }
        var forward = true;
        var backward = true;
        if (oneway == 'yes' || oneway == '1' || oneway == 'true') {
            backward = false;
        } else if (oneway == '-1' || oneway == 'reverse') {
            forward = false;
        }
        if (tags['oneway:bicycle'] == 'no') {
            return {forward: true, backward: true};
        }
        if (tags['oneway:bicycle'] == 'yes') {
            backward = false;
        }
        channelValues(sides, 'direction').forEach(function(direction) {
            if (direction == 'two_way') {
                forward = true;
                backward = true;
            } else if (direction == 'forward') {
                forward = true;
            } else if (direction == 'backward') {
                backward = true;
            }
        });
        return {forward: forward, backward: backward};
    }

    /* ---------- graph ---------- */

    function cellKey(cx, cy) {
        return cx + ':' + cy;
    }

    function addToGrid(grid, cx, cy, value) {
        var key = cellKey(cx, cy);
        var bucket = grid.get(key);
        if (bucket == undefined) {
            bucket = [];
            grid.set(key, bucket);
        }
        bucket.push(value);
    }

    /*
        @paths array|object the paths of the layer, as data/layer/{id} returns them
        @config object navigation config
        @support array|undefined supporting roads in the same form, see supportPaths()
    */
    function buildGraph(paths, config, support) {
        config = withDefaults(config);
        if (!Array.isArray(paths)) {
            paths = Object.keys(paths || {}).map(function(key) { return paths[key]; });
        }
        var graph = {
            lat: [], lon: [], x: [], y: [],
            adj: [], neighbours: [], vpaths: [],
            // vertices inside a no_gaps way, which gap links must not touch
            fixed: [],
            // supporting road paths by id, a route shows their cross-section on hover
            support: {},
            // every path by id, turn by turn directions name the ways a route takes
            paths: {},
            keys: new Map(),
            segments: [],
            // the straight links bridgeGaps() adds, they are in adj only
            links: [],
            // whether stretches in traffic currently cost prefer_separated_factor extra, see preferSeparated()
            prefer_separated: false,
            grid: new Map(),
            vgrid: new Map(),
            cell: config.cell,
            kx: 0, ky: 110540,
            min_factor: Infinity,
            gaps: 0,
            config: config
        };
        var first = null;
        paths.some(function(path) {
            if (path.nodes != undefined && path.nodes.length) {
                first = path.nodes[0];
                return true;
            }
            return false;
        });
        if (first == null) {
            return graph;
        }
        graph.kx = 111320 * Math.cos(first[0] * Math.PI / 180);

        function vertex(lat, lon, path_index) {
            var key = lat.toFixed(7) + ',' + lon.toFixed(7);
            var id = graph.keys.get(key);
            if (id == undefined) {
                id = graph.lat.length;
                graph.keys.set(key, id);
                graph.lat.push(lat);
                graph.lon.push(lon);
                graph.x.push(lon * graph.kx);
                graph.y.push(lat * graph.ky);
                graph.adj.push([]);
                graph.neighbours.push([]);
                graph.vpaths.push([]);
                graph.fixed.push(false);
                addToGrid(graph.vgrid, Math.floor(graph.x[id] / graph.cell), Math.floor(graph.y[id] / graph.cell), id);
            }
            var vpaths = graph.vpaths[id];
            if (vpaths[vpaths.length - 1] !== path_index) {
                vpaths.push(path_index);
            }
            return id;
        }

        function link(a, b) {
            if (graph.neighbours[a].indexOf(b) == -1) {
                graph.neighbours[a].push(b);
                graph.neighbours[b].push(a);
            }
        }

        var support_config = {
            rules: config.support_rules,
            modifiers: config.support_modifiers,
            default_factor: config.default_factor
        };
        var sources = paths.map(function(path) {
            return {path: path, support: false};
        }).concat((support || []).map(function(path) {
            return {path: path, support: true};
        }));
        sources.forEach(function(source, path_index) {
            var path = source.path;
            if (source.support) {
                graph.support[path.id] = path;
            }
            graph.paths[path.id] = path;
            if (path.nodes == undefined || path.nodes.length < 2) {
                return;
            }
            var tags = {};
            var key;
            for (key in (path.info || {})) {
                tags[key] = path.info[key];
            }
            for (key in (path.side_tags || {})) {
                tags[key] = path.side_tags[key];
            }
            var sides = path.sides || [];
            var scored = score(tags, sides, source.support ? support_config : config);
            if (scored == null) {
                return;
            }
            var direction = directions(tags, sides, config.respect_oneway);
            if (!direction.forward && !direction.backward) {
                return;
            }
            graph.min_factor = Math.min(graph.min_factor, scored.factor);
            var no_gaps = (config.no_gaps || []).some(function(rule) {
                return matches(rule.match || {}, tags, sides);
            });
            var last = path.nodes.length - 1;
            var previous = null;
            path.nodes.forEach(function(node, node_index) {
                var current = vertex(node[0], node[1], path_index);
                if (no_gaps && node_index > 0 && node_index < last) {
                    graph.fixed[current] = true;
                }
                if (previous !== null && previous !== current) {
                    var length = distance(graph, previous, current);
                    var segment = {
                        a: previous, b: current, length: length,
                        cost: length * scored.factor, factor: scored.factor, base_factor: scored.factor,
                        walk: scored.walk, infrastructure: scored.infrastructure,
                        forward: direction.forward, backward: direction.backward,
                        path: path.id, gap: false, support: source.support
                    };
                    // which summary line the stretch is on, so preferSeparated() knows what to make dearer
                    segment.line = summaryLine(segmentClass(segment, path), segment, path);
                    var index = graph.segments.length;
                    graph.segments.push(segment);
                    if (direction.forward) {
                        graph.adj[previous].push({to: current, segment: segment});
                    }
                    if (direction.backward) {
                        graph.adj[current].push({to: previous, segment: segment});
                    }
                    link(previous, current);
                    indexSegment(graph, index);
                }
                previous = current;
            });
        });
        graph.min_factor = Math.min(graph.min_factor, config.gap_factor);
        bridgeGaps(graph, config);
        return graph;
    }

    function distance(graph, a, b) {
        var dx = graph.x[a] - graph.x[b];
        var dy = graph.y[a] - graph.y[b];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function indexSegment(graph, index) {
        var segment = graph.segments[index];
        var cell = graph.cell;
        var x1 = Math.floor(Math.min(graph.x[segment.a], graph.x[segment.b]) / cell);
        var x2 = Math.floor(Math.max(graph.x[segment.a], graph.x[segment.b]) / cell);
        var y1 = Math.floor(Math.min(graph.y[segment.a], graph.y[segment.b]) / cell);
        var y2 = Math.floor(Math.max(graph.y[segment.a], graph.y[segment.b]) / cell);
        for (var cx = x1; cx <= x2; cx++) {
            for (var cy = y1; cy <= y2; cy++) {
                addToGrid(graph.grid, cx, cy, index);
            }
        }
    }

    /*
        Links vertices that are close but not connected: ones in a different connected
        component, and dead ends to a nearby way other than their own. Only the nearest
        vertex of each such component or way is linked, so a long parallel path does not
        get a ladder of links to everything around it.
    */
    function bridgeGaps(graph, config) {
        var count = graph.lat.length;
        var max = config.gap_distance;
        if (!(max > 0) || !count) {
            return;
        }
        var parent = new Int32Array(count);
        var i;
        for (i = 0; i < count; i++) {
            parent[i] = i;
        }
        function find(v) {
            while (parent[v] != v) {
                parent[v] = parent[parent[v]];
                v = parent[v];
            }
            return v;
        }
        for (i = 0; i < count; i++) {
            graph.neighbours[i].forEach(function(u) {
                var ru = find(u);
                var rv = find(i);
                if (ru != rv) {
                    parent[ru] = rv;
                }
            });
        }
        var components = new Int32Array(count);
        for (i = 0; i < count; i++) {
            components[i] = find(i);
        }
        var ring = Math.ceil(max / graph.cell);
        var added = new Set();
        for (var v = 0; v < count; v++) {
            if (graph.fixed[v]) {
                continue;
            }
            var dead_end = graph.neighbours[v].length == 1;
            var nearest = new Map();
            var cx = Math.floor(graph.x[v] / graph.cell);
            var cy = Math.floor(graph.y[v] / graph.cell);
            for (var dx = -ring; dx <= ring; dx++) {
                for (var dy = -ring; dy <= ring; dy++) {
                    var bucket = graph.vgrid.get(cellKey(cx + dx, cy + dy));
                    if (bucket == undefined) {
                        continue;
                    }
                    for (var k = 0; k < bucket.length; k++) {
                        var u = bucket[k];
                        if (u == v || graph.fixed[u]) {
                            continue;
                        }
                        var group = null;
                        if (components[u] != components[v]) {
                            group = 'c' + components[u];
                        } else if (dead_end && !sharesPath(graph, u, v) && graph.neighbours[v].indexOf(u) == -1) {
                            group = 'p' + graph.vpaths[u][0];
                        } else {
                            continue;
                        }
                        var d = distance(graph, u, v);
                        if (d > max) {
                            continue;
                        }
                        var best = nearest.get(group);
                        if (best == undefined || d < best.d) {
                            nearest.set(group, {u: u, d: d});
                        }
                    }
                }
            }
            nearest.forEach(function(best) {
                var key = Math.min(v, best.u) + '-' + Math.max(v, best.u);
                if (added.has(key)) {
                    return;
                }
                added.add(key);
                var segment = {
                    a: v, b: best.u, length: best.d,
                    cost: best.d * config.gap_factor, factor: config.gap_factor, base_factor: config.gap_factor,
                    walk: false, infrastructure: false,
                    forward: true, backward: true,
                    path: null, gap: true, line: 'traffic'
                };
                graph.links.push(segment);
                graph.adj[v].push({to: best.u, segment: segment});
                graph.adj[best.u].push({to: v, segment: segment});
            });
        }
        graph.gaps = added.size;
    }

    function sharesPath(graph, u, v) {
        var a = graph.vpaths[u];
        var b = graph.vpaths[v];
        for (var i = 0; i < a.length; i++) {
            if (b.indexOf(a[i]) != -1) {
                return true;
            }
        }
        return false;
    }

    /*
        Makes every stretch in traffic (what the map draws orange) cost prefer_separated_factor
        more, or puts the costs back, so a route sticks to separated cycle routes and footways
        (blue) where it can. The factors only grow, so the A* heuristic stays admissible.
        @return boolean whether anything changed
    */
    function preferSeparated(graph, prefer) {
        prefer = !!prefer;
        if (graph == null || graph.prefer_separated === prefer) {
            return false;
        }
        var extra = prefer ? graph.config.prefer_separated_factor : 1;
        if (!(extra > 0)) {
            extra = 1;
        }
        graph.segments.concat(graph.links).forEach(function(segment) {
            segment.factor = segment.base_factor * (segment.line == 'traffic' ? extra : 1);
            segment.cost = segment.length * segment.factor;
        });
        graph.prefer_separated = prefer;
        return true;
    }

    /* ---------- routing ---------- */

    // a click is joined to every path up to this many metres further than the nearest one
    var SNAP_SLACK = 30;
    var SNAP_CANDIDATES = 8;

    /*
        The points on (non gap) segments a clicked point can join the network at, nearest
        first: the nearest one within max metres, and the others hardly further away.
    */
    function snap(graph, lat, lon, max) {
        var x = lon * graph.kx;
        var y = lat * graph.ky;
        var cx = Math.floor(x / graph.cell);
        var cy = Math.floor(y / graph.cell);
        var best = null;
        var found = [];
        var seen = new Set();
        var rings = Math.ceil((max + SNAP_SLACK) / graph.cell) + 1;
        for (var r = 0; r <= rings; r++) {
            if (best != null && (r - 1) * graph.cell > best.distance + SNAP_SLACK) {
                break;
            }
            for (var dx = -r; dx <= r; dx++) {
                for (var dy = -r; dy <= r; dy++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) != r) {
                        continue;
                    }
                    var bucket = graph.grid.get(cellKey(cx + dx, cy + dy));
                    if (bucket == undefined) {
                        continue;
                    }
                    for (var k = 0; k < bucket.length; k++) {
                        if (seen.has(bucket[k])) {
                            continue;
                        }
                        seen.add(bucket[k]);
                        var segment = graph.segments[bucket[k]];
                        var ax = graph.x[segment.a];
                        var ay = graph.y[segment.a];
                        var sx = graph.x[segment.b] - ax;
                        var sy = graph.y[segment.b] - ay;
                        var length2 = sx * sx + sy * sy;
                        var t = length2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / length2 : 0;
                        t = Math.max(0, Math.min(1, t));
                        var px = ax + t * sx;
                        var py = ay + t * sy;
                        var d = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
                        if (d <= max + SNAP_SLACK) {
                            var candidate = {segment: segment, t: t, x: px, y: py, distance: d};
                            found.push(candidate);
                            if (best == null || d < best.distance) {
                                best = candidate;
                            }
                        }
                    }
                }
            }
        }
        if (best == null || best.distance > max) {
            return [];
        }
        return found.filter(function(candidate) {
            return candidate.distance <= best.distance + SNAP_SLACK;
        }).sort(function(a, b) {
            return a.distance - b.distance;
        }).slice(0, SNAP_CANDIDATES).map(function(candidate) {
            candidate.lat = candidate.y / graph.ky;
            candidate.lon = candidate.x / graph.kx;
            return candidate;
        });
    }

    /*
        The piece of a segment between a clicked point and the network. access is the cost
        of getting from the click onto the segment; start_snap and end_snap remember where.
    */
    function part(segment, length, access, start_snap, end_snap) {
        return {
            length: length, cost: length * segment.factor + (access || 0), factor: segment.factor,
            walk: segment.walk, infrastructure: segment.infrastructure,
            path: segment.path, gap: false, support: segment.support,
            start_snap: start_snap || null, end_snap: end_snap || null
        };
    }

    /* binary heap of vertex ids ordered by priority */
    function Heap() {
        this.ids = [];
        this.priorities = [];
    }
    Heap.prototype.push = function(id, priority) {
        var ids = this.ids;
        var priorities = this.priorities;
        var i = ids.length;
        ids.push(id);
        priorities.push(priority);
        while (i > 0) {
            var p = (i - 1) >> 1;
            if (priorities[p] <= priority) {
                break;
            }
            ids[i] = ids[p];
            priorities[i] = priorities[p];
            i = p;
        }
        ids[i] = id;
        priorities[i] = priority;
    };
    Heap.prototype.pop = function() {
        var ids = this.ids;
        var priorities = this.priorities;
        var top = ids[0];
        var last_id = ids.pop();
        var last_priority = priorities.pop();
        var length = ids.length;
        if (length) {
            var i = 0;
            while (true) {
                var l = 2 * i + 1;
                if (l >= length) {
                    break;
                }
                var r = l + 1;
                var c = (r < length && priorities[r] < priorities[l]) ? r : l;
                if (priorities[c] >= last_priority) {
                    break;
                }
                ids[i] = ids[c];
                priorities[i] = priorities[c];
                i = c;
            }
            ids[i] = last_id;
            priorities[i] = last_priority;
        }
        return top;
    };

    /*
        @from, @to [lat, lon]
        @return object {error} or {groups, length, time, infrastructure, gaps, walking, from, to}
    */
    function route(graph, from, to) {
        var config = graph.config;
        var starts = snap(graph, from[0], from[1], config.snap_distance);
        if (!starts.length) {
            return {error: 'from'};
        }
        var ends = snap(graph, to[0], to[1], config.snap_distance);
        if (!ends.length) {
            return {error: 'to'};
        }
        var count = graph.lat.length;
        var S = count;
        var T = count + 1;
        // the clicked points while searching, the points the route joins the network at afterwards
        var start = {x: from[1] * graph.kx, y: from[0] * graph.ky, lat: from[0], lon: from[1]};
        var end = {x: to[1] * graph.kx, y: to[0] * graph.ky, lat: to[0], lon: to[1]};
        var x = function(v) { return v == S ? start.x : (v == T ? end.x : graph.x[v]); };
        var y = function(v) { return v == S ? start.y : (v == T ? end.y : graph.y[v]); };
        var extra = new Map();
        function addExtra(v, edge) {
            if (!extra.has(v)) {
                extra.set(v, []);
            }
            extra.get(v).push(edge);
        }
        /*
            A click is joined to every path close to it rather than only the nearest, and
            getting there costs like a gap. The nearest can be a one-way street or a stretch
            cut off by closed roads - the route then simply joins at the next one.
        */
        starts.forEach(function(candidate) {
            var a = candidate.segment;
            var access = candidate.distance * config.gap_factor;
            if (a.forward) {
                addExtra(S, {to: a.b, segment: part(a, a.length * (1 - candidate.t), access, candidate, null)});
            }
            if (a.backward) {
                addExtra(S, {to: a.a, segment: part(a, a.length * candidate.t, access, candidate, null)});
            }
        });
        ends.forEach(function(candidate) {
            var b = candidate.segment;
            var access = candidate.distance * config.gap_factor;
            if (b.forward) {
                addExtra(b.a, {to: T, segment: part(b, b.length * candidate.t, access, null, candidate)});
            }
            if (b.backward) {
                addExtra(b.b, {to: T, segment: part(b, b.length * (1 - candidate.t), access, null, candidate)});
            }
        });
        starts.forEach(function(from_candidate) {
            ends.forEach(function(to_candidate) {
                var a = from_candidate.segment;
                if (a !== to_candidate.segment) {
                    return;
                }
                var access = (from_candidate.distance + to_candidate.distance) * config.gap_factor;
                if (to_candidate.t >= from_candidate.t && a.forward) {
                    addExtra(S, {to: T, segment: part(a, a.length * (to_candidate.t - from_candidate.t), access, from_candidate, to_candidate)});
                }
                if (to_candidate.t <= from_candidate.t && a.backward) {
                    addExtra(S, {to: T, segment: part(a, a.length * (from_candidate.t - to_candidate.t), access, from_candidate, to_candidate)});
                }
            });
        });
        var costs = new Float64Array(count + 2).fill(Infinity);
        var previous = new Int32Array(count + 2).fill(-1);
        var via = new Array(count + 2);
        var closed = new Uint8Array(count + 2);
        var tx = end.x;
        var ty = end.y;
        var factor = graph.min_factor;
        var heuristic = function(v) {
            var dx = x(v) - tx;
            var dy = y(v) - ty;
            return Math.sqrt(dx * dx + dy * dy) * factor;
        };
        var heap = new Heap();
        costs[S] = 0;
        heap.push(S, heuristic(S));
        var found = false;
        while (heap.ids.length) {
            var v = heap.pop();
            if (closed[v]) {
                continue;
            }
            if (v == T) {
                found = true;
                break;
            }
            closed[v] = 1;
            var edges = v < count ? graph.adj[v] : [];
            var more = extra.get(v);
            if (more != undefined) {
                edges = edges.concat(more);
            }
            for (var i = 0; i < edges.length; i++) {
                var edge = edges[i];
                var cost = costs[v] + edge.segment.cost;
                if (cost < costs[edge.to]) {
                    costs[edge.to] = cost;
                    previous[edge.to] = v;
                    via[edge.to] = edge.segment;
                    heap.push(edge.to, cost + heuristic(edge.to));
                }
            }
        }
        if (!found) {
            return {error: 'route'};
        }
        var vertices = [];
        var segments = [];
        for (var current = T; current != -1; current = previous[current]) {
            vertices.unshift(current);
            if (via[current] != undefined) {
                segments.unshift(via[current]);
            }
        }
        start = segments[0].start_snap || start;
        end = segments[segments.length - 1].end_snap || end;
        var latlng = function(v) {
            return v == S ? [start.lat, start.lon] : (v == T ? [end.lat, end.lon] : [graph.lat[v], graph.lon[v]]);
        };
        // metres per legend category, they add up to the length: every stretch is in exactly one
        var categories = {};
        CATEGORIES.forEach(function(category) {
            categories[category.key] = 0;
        });
        var result = {
            groups: [], length: 0, time: 0, categories: categories,
            summary: {separated: 0, traffic: 0, footway: 0}, gaps: 0, walking: 0,
            from: [start.lat, start.lon], to: [end.lat, end.lon]
        };
        var group = null;
        segments.forEach(function(segment, index) {
            var path = segment.path != null ? graph.paths[segment.path] : null;
            var kind = segmentClass(segment, path);
            var line = summaryLine(kind, segment, path);
            // drawn blue on separated routes and footways, orange wherever it is in traffic
            var colour = line == 'traffic' ? 'traffic' : 'path';
            var style = segment.gap ? 'gap' : '';
            // a supporting road is a group of its own, so that each stretch knows the street for its cross-section
            var key = colour + '|' + style + (segment.support ? '|' + segment.path : '');
            if (group == null || group.key != key) {
                group = {
                    kind: colour,
                    style: style,
                    key: key,
                    path: segment.support && !segment.gap ? (graph.support[segment.path] || null) : null,
                    latlngs: [latlng(vertices[index])]
                };
                result.groups.push(group);
            }
            group.latlngs.push(latlng(vertices[index + 1]));
            result.length += segment.length;
            // seconds, kept on the segment so the steps add up to the same time
            segment.time = segment.length / ((segment.walk ? config.walking_speed : config.speed) / 3.6);
            result.time += segment.time;
            categories[kind] += segment.length;
            result.summary[line] += segment.length;
            if (segment.gap) {
                result.gaps += segment.length;
            }
            if (segment.walk) {
                result.walking += segment.length;
            }
        });
        result.steps = buildSteps(graph, segments, vertices, x, y, latlng);
        return result;
    }

    /*
        Turns the compact roads file (data/navigation) into paths buildGraph() takes.
        points is one flat lat, lon list shared by all ways, n indexes into it.
    */
    /* ---------- turn by turn ---------- */

    // steps shorter than this are folded into the one before, OSM splits a street on every detail
    var STEP_MIN_LENGTH = 15;
    // how far before and after a junction the direction of travel is measured
    var HEADING_DISTANCE = 20;
    // kinds of step that stay on their own however short they are
    var KEEP_SHORT = ['crossing', 'steps', 'roundabout'];
    // a gap shorter than this is a mapping detail rather than something to tell the rider
    var GAP_MIN_LENGTH = 30;
    // kinds of step that are an instruction of their own, never merged with the way before or after them
    var UNMERGED = KEEP_SHORT.concat(['gap']);

    /*
        A route is summed up by the entries of the layer's own legend - separated, in traffic,
        recommended, usable footways, for mountain bikes - plus where there is nothing for cycling
        at all: a road only connects, or the network has a gap. The categories mark the turn by turn
        steps; the map and the panel go by the three summary lines, see summaryLine().
    */
    var CATEGORIES = [
        {key: 'separated'},
        {key: 'traffic'},
        {key: 'recommended'},
        {key: 'footway'},
        {key: 'mtb'},
        {key: 'none'}
    ];
    // the panel sums a route up in three lines only, see summaryLine()
    var SUMMARY = [
        {key: 'separated', label: 'Separated cycle routes'},
        {key: 'traffic', label: 'In traffic'},
        {key: 'footway', label: 'Usable (footways)'}
    ];
    var FOOTWAY_HIGHWAYS = ['footway', 'pedestrian', 'path', 'steps', 'bridleway', 'corridor'];
    var BICYCLES_ALLOWED = ['yes', 'designated', 'permissive', 'official'];
    var UNPAVED = ['unpaved', 'gravel', 'fine_gravel', 'dirt', 'earth', 'ground', 'grass', 'mud', 'sand', 'compacted', 'pebblestone', 'woodchips'];

    // the kinds of way that are a road, as opposed to a footway, a path, steps or a crossing
    var ROAD_HIGHWAYS = [
        'residential', 'living_street', 'service', 'unclassified', 'road', 'track',
        'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'primary', 'primary_link'
    ];

    /*
        The summary line a stretch counts in: separated - and paths for mountain bikes - is separated;
        anything else on a road (or a tram line, or a gap between roads) is in traffic; the rest is
        on footways and paths.
    */
    function summaryLine(kind, segment, path) {
        if (kind == 'separated' || kind == 'mtb') {
            return 'separated';
        }
        if (segment.gap || path == null) {
            return 'traffic';
        }
        var tags = pathTags(path);
        return tags.railway == 'tram' || ROAD_HIGHWAYS.indexOf(tags.highway) != -1 ? 'traffic' : 'footway';
    }

    /* which legend entry a stretch belongs to, following the rules the city stylesheet colours the layer by */
    function segmentClass(segment, path) {
        if (segment.gap || path == null) {
            return 'none';
        }
        if (segment.walk) {
            return 'footway';
        }
        var tags = pathTags(path);
        var allowed = BICYCLES_ALLOWED.indexOf(tags.bicycle) != -1;
        if (tags['mtb:scale'] != undefined
            || (UNPAVED.indexOf(tags.surface) != -1 && (allowed || tags.highway == 'cycleway'))
            || (tags.highway == 'track' && allowed)) {
            return 'mtb';
        }
        if (tags.highway == 'cycleway' || tags.cycleway == 'crossing') {
            return 'separated';
        }
        // a road closed to motor vehicles is as good as a cycle path, whatever its highway tag says
        if (ROAD_HIGHWAYS.indexOf(tags.highway) != -1 && tags.motor_vehicle == 'no') {
            return 'separated';
        }
        if (tags.lcn == 'provisional' || tags.lcn == 'proposed') {
            return 'recommended';
        }
        if (FOOTWAY_HIGHWAYS.indexOf(tags.highway) != -1) {
            return allowed ? 'separated' : 'footway';
        }
        if (segment.infrastructure) {
            return inTraffic(tags, path) ? 'traffic' : 'separated';
        }
        // a supporting road has nothing for cycling, a way of the layer is in it for something it has
        return segment.support ? 'none' : 'traffic';
    }

    /*
        The words of each legend entry, read from the layer's legend in the map config, so the
        panel names things exactly as the layer switcher does. navigation.legend says which entry
        (by its swatch class) each category is.
    */
    function legendEntries() {
        var entries = {};
        var layers = window.core != undefined && core.config != undefined ? core.config.layers : null;
        var layer = layers != null ? layers[state.config.layer] : null;
        if (layer == null || !layer.name) {
            return entries;
        }
        var found = {};
        var pattern = /<span class="([^"]+)">([^<]*)<\/span>\s*([^<]*)/g;
        var match;
        // in the page's language, as the layers control shows it (main.js)
        var name = typeof translateConfigText == 'function' ? translateConfigText(layer.name) : layer.name;
        while ((match = pattern.exec(name)) !== null) {
            // the legend's own mark as well - its colour and its line, full or dotted - for the turn by turn steps
            found[match[1]] = {swatch: '<span class="' + match[1] + '">' + match[2] + '</span>', cls: match[1], dotted: match[2].indexOf('•') != -1, label: match[3].trim()};
        }
        for (var key in (state.config.legend || {})) {
            if (found[state.config.legend[key]] != undefined) {
                entries[key] = found[state.config.legend[key]];
            }
        }
        return entries;
    }

    /* a painted lane the legend counts as in traffic: advisory, or on a 50 km/h street, unless there is a track too */
    function inTraffic(tags, path) {
        for (var key in tags) {
            if (/^cycleway(:(left|right|both))?:lane$/.test(key) && tags[key] == 'advisory') {
                return true;
            }
        }
        var forms = channelValues(path.sides, 'form');
        if (forms.indexOf('track') != -1 || forms.indexOf('lane') == -1) {
            return false;
        }
        return tags.maxspeed == '50' || /urban/i.test(tags['maxspeed:type'] || '');
    }

    function pathTags(path) {
        var tags = {};
        var key;
        for (key in (path.info || {})) {
            tags[key] = path.info[key];
        }
        for (key in (path.side_tags || {})) {
            tags[key] = path.side_tags[key];
        }
        return tags;
    }

    // what ways are called is shared with the map's sidebar and the cross-section; in node it is required for tests
    var names = typeof wayNames != 'undefined' ? wayNames : (typeof require == 'function' ? require('./waynames.js') : null);

    /* what a way is (waynames.js), named in the words the map and the cross-section use once the steps are built */
    function wayLabel(path) {
        if (path == null || names == null) {
            return '';
        }
        return names.kind(pathTags(path), path.sides);
    }

    /* adds metres of a way's name to a step, keeping the names in the order the route meets them */
    function addLabel(step, label, metres) {
        if (!label) {
            return;
        }
        if (step.label_metres[label] == undefined) {
            step.label_metres[label] = 0;
            step.labels.push(label);
        }
        step.label_metres[label] += metres || 0;
    }

    /* what a stretch of the route is, which steps are grouped by */
    function segmentType(segment, path) {
        if (segment.gap || path == null) {
            return 'gap';
        }
        var tags = pathTags(path);
        var forms = channelValues(path.sides, 'form');
        var has = function(list) {
            return forms.some(function(form) {
                return list.indexOf(form) != -1;
            });
        };
        if (tags.footway == 'crossing' || tags.cycleway == 'crossing' || tags.path == 'crossing' || tags.highway == 'crossing') {
            return 'crossing';
        }
        if (tags.highway == 'steps') {
            return 'steps';
        }
        if (tags.junction == 'roundabout' || tags.junction == 'circular') {
            return 'roundabout';
        }
        if (tags.highway == 'cycleway') {
            return 'cycle_path';
        }
        if (has(['track', 'lane', 'opposite_lane', 'opposite_track', 'sidepath'])) {
            return 'cycle_lane';
        }
        if (['footway', 'pedestrian', 'path', 'bridleway'].indexOf(tags.highway) != -1) {
            return tags.bicycle == 'designated' ? 'cycle_path' : 'footway';
        }
        if (tags.railway == 'tram') {
            return 'tram';
        }
        if (tags.highway == 'track') {
            return 'track';
        }
        if (has(['shared_lane', 'share_busway', 'shared_busway', 'opposite', 'shoulder'])) {
            return 'shared_lane';
        }
        return segment.support ? 'road' : 'street';
    }

    function turnOf(delta) {
        var angle = Math.abs(delta);
        var side = delta > 0 ? 'right' : 'left';
        if (angle < 25) {
            return 'straight';
        }
        if (angle < 60) {
            return 'slight_' + side;
        }
        // a sharp turn is still a turn, one more kind of arrow only made the list harder to read
        return side;
    }

    /*
        Joins the stretches of a route into steps - one per street, or per kind of way where
        it has no name - and works out the turn into each from the direction of travel just
        before and just after the junction.
        @segments, @vertices the route, vertices[i] and vertices[i + 1] are the ends of segments[i]
        @return array of {type, labels, name, walk, turn, exit, length, time, category, latlngs}, ending with an arrive step;
        labels names every kind of way a step goes along (waynames.js), type is what the step is grouped by
    */
    function buildSteps(graph, segments, vertices, x, y, latlng) {
        var raw = [];
        segments.forEach(function(segment, index) {
            var path = segment.path != null ? graph.paths[segment.path] : null;
            var type = segmentType(segment, path);
            var name = type != 'gap' && path != null ? (pathTags(path).name || '') : '';
            // a named street is one step, whether its pieces came from the layer or the supporting roads
            var group = (type == 'road' || type == 'street') && name ? 'street' : type;
            var key = group + '|' + name + '|' + (segment.walk ? 1 : 0);
            // metres per legend category, a step is marked with the one it mostly is
            var category = segmentClass(segment, path);
            // metres per name of the way, in the words the map and the cross-section use for it
            var way_label = type != 'gap' ? wayLabel(path) : '';
            var last = raw[raw.length - 1];
            if (last != undefined && last.key == key) {
                last.length += segment.length;
                last.time += segment.time;
                last.to = index + 1;
                last.categories[category] = (last.categories[category] || 0) + segment.length;
                addLabel(last, way_label, segment.length);
                return;
            }
            var categories = {};
            categories[category] = segment.length;
            var step = {key: key, type: type, name: name, walk: !!segment.walk, length: segment.length, time: segment.time, from: index, to: index + 1, categories: categories, labels: [], label_metres: {}};
            addLabel(step, way_label, segment.length);
            raw.push(step);
        });
        var absorb = function(into, step) {
            into.length += step.length;
            into.time += step.time;
            into.to = step.to;
            for (var category in step.categories) {
                into.categories[category] = (into.categories[category] || 0) + step.categories[category];
            }
            step.labels.forEach(function(label) {
                addLabel(into, label, step.label_metres[label]);
            });
        };
        // short pieces, and short gaps, go into the step before them
        var folded = [];
        raw.forEach(function(step) {
            var previous = folded[folded.length - 1];
            // a few metres of walking is not worth a line of its own either, stairs excepted
            var tiny = step.type == 'gap'
                ? step.length < GAP_MIN_LENGTH
                : step.length < STEP_MIN_LENGTH && KEEP_SHORT.indexOf(step.type) == -1;
            if (previous != undefined && (tiny || previous.key == step.key)) {
                absorb(previous, step);
                return;
            }
            folded.push(step);
        });
        /*
            A crossing between two pieces of the same way is the path crossing a side street,
            not a change of route, so it disappears into that way. One that joins different
            ways stays, it is where the rider actually crosses over.
        */
        var steps = [];
        for (var s = 0; s < folded.length; s++) {
            var step = folded[s];
            var previous = steps[steps.length - 1];
            var next = folded[s + 1];
            if (step.type == 'crossing' && previous != undefined && next != undefined && previous.key == next.key && !step.walk) {
                absorb(previous, step);
                absorb(previous, next);
                s++;
                continue;
            }
            if (previous != undefined && previous.key == step.key) {
                absorb(previous, step);
                continue;
            }
            steps.push(step);
        }
        var distance = function(a, b) {
            var dx = x(vertices[a]) - x(vertices[b]);
            var dy = y(vertices[a]) - y(vertices[b]);
            return Math.sqrt(dx * dx + dy * dy);
        };
        // index of the route vertex about metres away from index, going back (-1) or forward (1)
        var along = function(index, metres, direction) {
            var travelled = 0;
            var current = index;
            while (travelled < metres) {
                var next = current + direction;
                if (next < 0 || next >= vertices.length) {
                    break;
                }
                travelled += distance(current, next);
                current = next;
            }
            return current;
        };
        // compass bearing, 0 north and 90 east
        var heading = function(a, b) {
            return Math.atan2(x(vertices[b]) - x(vertices[a]), y(vertices[b]) - y(vertices[a])) * 180 / Math.PI;
        };
        var count = graph.lat.length;
        var after_roundabout = false;
        steps.forEach(function(step, index) {
            step.turn = 'straight';
            if (index > 0 && !after_roundabout) {
                var before = along(step.from, HEADING_DISTANCE, -1);
                var ahead = along(step.from, HEADING_DISTANCE, 1);
                if (before != step.from && ahead != step.from) {
                    var delta = heading(step.from, ahead) - heading(before, step.from);
                    delta = ((delta + 540) % 360) - 180;
                    step.turn = turnOf(delta);
                }
            }
            after_roundabout = step.type == 'roundabout';
            if (step.type == 'roundabout') {
                // every junction on the way round is an exit, the one the route leaves by included
                step.exit = 0;
                for (var i = step.from + 1; i <= step.to; i++) {
                    var v = vertices[i];
                    if (v < count && graph.neighbours[v].length > 2) {
                        step.exit++;
                    }
                }
                step.exit = Math.max(1, step.exit);
            }
        });
        /*
            Straight on from one kind of way onto another of the same name, or both without one, is
            not an instruction of its own: the steps become one that names every kind it goes along,
            and is marked with the category most of its length is. A crossing straight ahead is no
            instruction either, it goes into the way before it, whatever that is called.
        */
        var merged = [];
        steps.forEach(function(step) {
            var previous = merged[merged.length - 1];
            var straight_crossing = step.type == 'crossing' && step.turn == 'straight';
            if (previous != undefined && step.turn == 'straight' && (step.name == previous.name || straight_crossing)
                && (UNMERGED.indexOf(step.type) == -1 || straight_crossing) && UNMERGED.indexOf(previous.type) == -1) {
                absorb(previous, step);
                previous.walk = previous.walk || step.walk;
                return;
            }
            merged.push(step);
        });
        steps = merged;
        steps.forEach(function(step) {
            step.latlngs = vertices.slice(step.from, step.to + 1).map(latlng);
            step.category = null;
            for (var key in step.categories) {
                if (step.category == null || step.categories[key] > step.categories[step.category]) {
                    step.category = key;
                }
            }
            /*
                The names of what the step goes along, in route order. A few metres of something else
                - a bit of footway at the end of a pedestrian zone - is not worth naming.
            */
            var kinds = step.labels.filter(function(kind) {
                // a crossing on the way is part of it, and a crossing step is named for the crossing alone
                return step.type == 'crossing' ? kind.indexOf('crossing_') == 0 : kind.indexOf('crossing_') != 0;
            });
            if (!kinds.length) {
                kinds = step.labels;
            }
            var named = kinds.filter(function(kind) {
                return step.label_metres[kind] >= STEP_MIN_LENGTH;
            });
            if (!named.length && kinds.length) {
                named = [kinds.reduce(function(best, kind) {
                    return step.label_metres[kind] > step.label_metres[best] ? kind : best;
                })];
            }
            // two kinds with the same words - a lane on each side - are named once
            step.labels = named.map(function(kind) {
                return names.label(kind);
            }).filter(function(label, i, labels) {
                return labels.indexOf(label) == i;
            });
            delete step.label_metres;
            delete step.key;
            delete step.categories;
        });
        if (steps.length) {
            steps.push({type: 'arrive', labels: [], name: '', walk: false, turn: 'straight', length: 0, time: 0, latlngs: [latlng(vertices[vertices.length - 1])]});
        }
        return steps;
    }

    // @layer_id the navigation layer, so the roads are drawn in cross-section the way its paths are
    function supportPaths(data, layer_id) {
        if (data == null || !Array.isArray(data.ways) || !Array.isArray(data.points)) {
            return [];
        }
        var points = data.points;
        return data.ways.map(function(way) {
            return {
                id: 'support-' + way.id,
                layer_id: layer_id,
                nodes: way.n.map(function(index) {
                    return [points[2 * index], points[2 * index + 1]];
                }),
                // an empty tag object comes out of PHP as a list
                info: Array.isArray(way.t) ? {} : (way.t || {})
            };
        });
    }

    /* ---------- share links ---------- */

    var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    // 1e-5 degrees, about a metre
    var PRECISION = 100000;
    var LINK_VERSION = '1';

    /* @bounding_box string "south,west,north,east", as the Overpass config has it */
    function parseBoundingBox(bounding_box) {
        var parts = String(bounding_box || '').split(',').map(parseFloat);
        if (parts.length != 4 || parts.some(isNaN)) {
            return null;
        }
        var box = {
            south: Math.min(parts[0], parts[2]),
            west: Math.min(parts[1], parts[3]),
            north: Math.max(parts[0], parts[2]),
            east: Math.max(parts[1], parts[3])
        };
        box.lat_span = Math.round((box.north - box.south) * PRECISION);
        box.lon_span = Math.round((box.east - box.west) * PRECISION);
        box.lat_bits = Math.max(1, Math.ceil(Math.log2(box.lat_span + 1)));
        box.lon_bits = Math.max(1, Math.ceil(Math.log2(box.lon_span + 1)));
        return box;
    }

    function pad(binary, length) {
        while (binary.length < length) {
            binary = '0' + binary;
        }
        return binary;
    }

    /*
        The points as metre steps from the south-west corner of the bounding box, packed
        bit by bit into URL safe base64. The bits per number follow from the size of the
        box - 15 for Bratislava, so a route is 10 characters instead of ~36 for plain
        coordinates. The leading version character leaves room to change the format.
        @points array of [lat, lon]
        @return string|null, null when a point lies outside the box
    */
    function encodePoints(points, bounding_box) {
        var box = parseBoundingBox(bounding_box);
        if (box == null) {
            return null;
        }
        var bits = '';
        for (var i = 0; i < points.length; i++) {
            var lat = Math.round((points[i][0] - box.south) * PRECISION);
            var lon = Math.round((points[i][1] - box.west) * PRECISION);
            if (!(lat >= 0 && lat <= box.lat_span && lon >= 0 && lon <= box.lon_span)) {
                return null;
            }
            bits = bits + pad(lat.toString(2), box.lat_bits) + pad(lon.toString(2), box.lon_bits);
        }
        while (bits.length % 6) {
            bits = bits + '0';
        }
        var code = LINK_VERSION;
        for (var j = 0; j < bits.length; j += 6) {
            code = code + ALPHABET.charAt(parseInt(bits.substr(j, 6), 2));
        }
        return code;
    }

    /*
        Reads what encodePoints() wrote, or plain "lat,lon;lat,lon" used for points
        outside the bounding box.
        @return array|null exactly count [lat, lon] points, null when the code is not valid
    */
    function decodePoints(code, bounding_box, count) {
        code = String(code || '');
        var points = [];
        if (code.indexOf(',') != -1) {
            code.split(';').forEach(function(point) {
                var coordinates = point.split(',').map(parseFloat);
                if (coordinates.length == 2 && !isNaN(coordinates[0]) && !isNaN(coordinates[1])
                    && Math.abs(coordinates[0]) <= 90 && Math.abs(coordinates[1]) <= 180) {
                    points.push(coordinates);
                }
            });
            return points.length == count ? points : null;
        }
        var box = parseBoundingBox(bounding_box);
        if (box == null || code.charAt(0) != LINK_VERSION) {
            return null;
        }
        var bits = '';
        for (var i = 1; i < code.length; i++) {
            var value = ALPHABET.indexOf(code.charAt(i));
            if (value == -1) {
                return null;
            }
            bits = bits + pad(value.toString(2), 6);
        }
        var per_point = box.lat_bits + box.lon_bits;
        for (var offset = 0; offset + per_point <= bits.length && points.length < count; offset += per_point) {
            var lat = parseInt(bits.substr(offset, box.lat_bits), 2);
            var lon = parseInt(bits.substr(offset + box.lat_bits, box.lon_bits), 2);
            if (lat > box.lat_span || lon > box.lon_span) {
                return null;
            }
            points.push([box.south + lat / PRECISION, box.west + lon / PRECISION]);
        }
        return points.length == count ? points : null;
    }

    /* ---------- map UI ---------- */

    var state = {
        map: null, config: null, graph: null, loading: false, failed: false,
        active: false, from: null, to: null, markers: {},
        routes: null, points: null, button: null, down: null, result: null,
        // whether routes keep to separated cycle routes, kept in localStorage
        prefer_separated: false,
        // a shared link without a view zooms to the route once it is known
        fit: false,
        // the animation over the map while a route with both ends is waiting for the network
        loading_overlay: null
    };

    function t(text) {
        return typeof i18n == 'function' ? i18n(text) : text;
    }

    function escape(text) {
        return String(text).replace(/[&<>"']/g, function(character) {
            return '&#' + character.charCodeAt(0) + ';';
        });
    }

    function language() {
        return (window.core != undefined && core.config != undefined && core.config.language) || undefined;
    }

    /* "1,9 km (41%)" - how far, then how much of the whole route that is */
    function share(metres, total) {
        var percent = total > 0 ? Math.round(100 * metres / total) : 0;
        // a few metres of a long route are still there, "0%" would say they are not
        var text = percent < 1 && metres > 0 ? '<1%' : percent + '%';
        return '<strong>' + formatDistance(metres) + '</strong> (' + text + ')';
    }

    function formatDistance(metres) {
        if (metres >= 1000) {
            return (metres / 1000).toLocaleString(language(), {maximumFractionDigits: 1}) + ' ' + t('km');
        }
        return Math.round(metres) + ' ' + t('m');
    }

    // @seconds in whole minutes, at least one
    function formatTime(seconds) {
        return Math.max(1, Math.round(seconds / 60)) + ' ' + t('min');
    }

    /*
        How far apart the steps that show a distance are: about 2·√km of them on a route - a couple on a
        short trip, a dozen at most on a long one - spaced by the round distance nearest to that share.
    */
    var DISTANCE_SPACINGS = [100, 250, 500, 1000, 2000, 5000, 10000];
    function distanceSpacing(total) {
        var count = Math.min(12, Math.max(2, Math.round(2 * Math.sqrt(total / 1000))));
        var wanted = total / count;
        return DISTANCE_SPACINGS.reduce(function(best, spacing) {
            return Math.abs(Math.log(spacing / wanted)) < Math.abs(Math.log(best / wanted)) ? spacing : best;
        });
    }

    function init(map, config) {
        if (state.map != null || map == undefined || window.L == undefined) {
            return;
        }
        state.map = map;
        state.config = withDefaults(config);
        state.prefer_separated = readPreference();
        map.createPane('navigation');
        map.getPane('navigation').style.zIndex = 450;
        var renderer = L.svg({pane: 'navigation'});
        state.routes = L.layerGroup().addTo(map);
        state.routes.renderer = renderer;
        state.points = L.layerGroup().addTo(map);
        if (L.easyButton != undefined) {
            // a bicycle riding a dotted line to a pin; sizes and transforms as attributes, so Safari draws it too
            var icon = '<svg class="navigation-icon" xmlns="http://www.w3.org/2000/svg" width="48" height="20" viewBox="0 0 48 20" fill="currentColor" aria-hidden="true"><g transform="translate(21.8 6.32) scale(-0.010758199999999999 0.010758199999999999)"><path transform="matrix(.1 0 0 -.1 0 1123)" d="m7615 11224c-93-8-195-28-270-51-365-114-662-417-769-784-63-218-58-481 12-681l19-54-615-1524c-339-839-616-1526-617-1527-1-2-62 31-136 72-479 268-991 412-1601 450l-98 6v-43c0-24-3-59-6-79l-6-36-187-6c-758-26-1490-307-2088-804-125-104-377-360-475-483-427-535-679-1142-754-1815-20-180-22-536-5-710 112-1093 702-2045 1628-2627 157-98 445-240 613-303 841-312 1773-291 2594 60 530 226 1007 592 1361 1045 37 47 71 89 75 94 6 5 32-8 64-32 30-23 59-42 64-42s43 51 84 113c334 501 532 1047 600 1657 19 173 16 613-6 785-87 697-349 1325-778 1863-117 146-391 423-524 530l-91 74 99 251c55 139 103 255 107 259 5 6 3694-3193 3789-3286l24-23-36-96c-98-262-86-578 33-831 132-284 380-500 668-585 107-31 189-43 317-44l119-2 108-355c60-195 109-361 109-367 0-10-30-13-115-13h-115v-195-195l493 2 492 3 3 193 2 192h-174-175l-15 48c-7 26-67 218-131 427-108 348-116 380-100 390 306 179 488 424 556 749 10 48 19 89 21 91 5 3 641 45 645 42 1-2 12-57 23-123 235-1395 1296-2509 2682-2818 850-189 1764-43 2516 403 954 565 1590 1560 1694 2649l12 131 77-6 76-6 6 128c10 223-16 558-64 799-303 1536-1539 2700-3089 2911-661 90-1363-13-1968-287-73-33-135-58-137-56-13 13-988 1705-988 1714 0 16 354 817 367 830 6 6 237 113 514 239 277 125 522 241 546 256 49 33 100 100 122 161 8 24 15 76 15 116 0 61-5 85-29 137-57 120-147 182-285 196-129 13-921 29-1774 36-639 5-790 4-829-7-63-18-147-98-163-155-25-91 1-197 62-253 59-55 727-398 1177-606 124-57 224-108 223-114-3-13-317-712-344-764l-19-38h-3145c-1730 0-3145 3-3145 8 0 4 105 266 233 582l233 575-37 80c-157 339-41 755 271 965 143 97 288 136 470 127 105-5 149-14 510-110 488-129 500-131 510-121 4 5 28 89 53 186l45 178-36 9c-346 91-871 222-917 230-72 11-224 20-280 15zm5062-3116c-3-7-397-896-877-1976l-873-1963-91 7c-50 4-131 8-180 8l-89 1-109 350c-59 193-108 351-108 353 0 1 68 2 150 2h150v190 190h-495-495v-190-189l142-3 141-3 118-385c65-212 121-398 124-415 5-28 2-32-55-64-33-19-88-57-121-83l-60-49-112 98c-62 54-934 815-1940 1692-1005 876-1827 1597-1827 1602s75 196 166 424l166 415h3140c2508 0 3139-3 3135-12zm812-817c232-403 421-735 419-737s-56-41-120-86c-169-120-315-244-469-398-547-546-889-1208-1023-1980-32-180-43-297-52-518-7-164-8-173-28-177-12-2-88-7-171-10-82-3-184-8-225-11l-75-6-18 64c-27 92-92 220-157 307-64 85-183 203-248 246-24 16-41 33-38 39 2 6 399 900 881 1986s881 1986 886 1999 11 22 13 20 193-334 425-738zm-9650-906c411-51 855-208 1178-417l81-53-347-861c-191-473-359-882-374-907-98-166-250-303-432-388-120-56-217-79-381-88-120-7-147-11-177-30-104-64-124-197-44-288 47-54 79-63 215-63 433 0 859 226 1096 583 83 125 131 232 456 1032 166 407 306 744 311 750 13 13 229-207 339-345 337-423 544-915 617-1467 23-177 23-543-1-713-49-360-143-665-296-965-138-272-293-486-515-713-381-392-847-661-1370-791-799-200-1644-54-2320 399-175 118-286 209-446 369-328 328-557 695-702 1121-321 941-139 1975 485 2763 105 131 324 351 457 456 467 370 1000 581 1592 631 137 11 424 4 578-15zm12397 0c516-66 978-254 1399-569 147-110 439-399 546-541 321-423 506-867 586-1400 25-169 25-600 0-770-127-861-579-1580-1290-2052-369-245-780-397-1242-459-158-21-531-24-680-5-1002 125-1842 717-2293 1616-56 113-145 340-182 470-39 135-91 378-82 386 7 7 2434 169 2516 169 31 0 47-8 88-45 208-187 531-122 651 132 30 63 32 75 32 174 0 101-1 108-38 181-59 121-167 204-297 228-30 6-60 16-66 23-25 27-1264 2189-1259 2197 9 14 219 99 358 145 213 70 440 115 676 135 140 11 428 4 577-15zm-1322-1556 629-1091-28-59c-27-55-31-59-69-63-23-3-587-42-1255-86-965-64-1216-78-1222-68-18 28 11 366 47 563 133 729 558 1399 1162 1832 48 34 92 63 97 62 6 0 293-491 639-1090z"/></g><circle cx="22.8" cy="12.2" r=".75"/><circle cx="25.28" cy="14.18" r=".75"/><circle cx="28.2" cy="15.2" r=".75"/><circle cx="31.15" cy="14.16" r=".75"/><circle cx="33.6" cy="12.2" r=".75"/><circle cx="36.08" cy="10.22" r=".75"/><circle cx="39.04" cy="9.2" r=".75"/><circle cx="41.95" cy="10.24" r=".75"/><circle cx="44.4" cy="12.2" r=".75"/><path fill-rule="evenodd" d="M41.4 3.6A3 3 0 0 1 47.4 3.6C47.4 6.3 45.45 8.1 44.4 10.2C43.35 8.1 41.4 6.3 41.4 3.6ZM43.2 3.6A1.2 1.2 0 1 0 45.6 3.6A1.2 1.2 0 1 0 43.2 3.6Z"/></svg>';
            state.button = L.easyButton('<span class="navigation-toggle" data-toggle="tooltip" data-placement="right" data-i18n-title="Navigation" title="' + escape(t('Navigation')) + '">' + icon + '</span>', toggle, {
                position: 'topleft'
            }).addTo(map);
            state.button.button.classList.add('navigation-button');
        }
        var container = map.getContainer();
        container.addEventListener('pointerdown', function(e) {
            state.down = [e.clientX, e.clientY];
        }, true);
        // the buttons hidden when a route was fitted come back on the first touch of the map, and stay
        ['pointerdown', 'touchstart', 'wheel'].forEach(function(name) {
            container.addEventListener(name, function() {
                document.body.classList.remove('navigation-controls-hidden');
            }, {capture: true, passive: true});
        });
        // capture phase, so that while navigating a click places a point instead of opening what is under it
        container.addEventListener('click', onMapClick, true);
        document.addEventListener('click', onPanelClick);
        // right-click: offered first in the map's menu, and while only the start is set the next one places the destination
        if (window.core != undefined && Array.isArray(core.context_actions) && Array.isArray(core.context_handlers)) {
            core.context_actions.push({
                label: function() {
                    return t('Navigate from here');
                },
                order: 0,
                run: startAt
            });
            core.context_handlers.push(function(latlng) {
                if (state.active && state.from != null && state.to == null) {
                    setPoint('to', latlng);
                    return true;
                }
                return false;
            });
        }
        // the route goes into the address bar with the rest of the view, so a copied address carries it too
        if (window.core != undefined && Array.isArray(core.fragment_params)) {
            core.fragment_params.push(function() {
                return state.active && state.from != null && state.to != null ? 'n=' + linkCode() : '';
            });
        }
        // another language: the panel, the steps and their names are written again in it
        if (window.core != undefined && Array.isArray(core.language_handlers)) {
            core.language_handlers.push(function() {
                if (!state.active) {
                    return false;
                }
                if (state.graph != null && state.from != null && state.to != null) {
                    cancelScheduledUpdate();
                    update();
                } else {
                    showPanel();
                }
                return true;
            });
        }
        // runs from the page's inline script, before main.js first reads and rewrites the fragment
        readLink();
    }

    /* ---------- preferring separated routes ---------- */

    var PREFERENCE_KEY = 'navigation.prefer_separated';

    function readPreference() {
        try {
            return window.localStorage.getItem(PREFERENCE_KEY) == '1';
        } catch (error) {
            return false;
        }
    }

    function storePreference(prefer) {
        try {
            window.localStorage.setItem(PREFERENCE_KEY, prefer ? '1' : '0');
        } catch (error) {
            // private windows and blocked storage: the choice lasts for the page
        }
    }

    /* the toggle next to the panel's heading, filled blue while it is on */
    function preferButtonHtml() {
        var title = t('Prefer segregated cycle routes');
        return '<button type="button" class="btn btn-sm navigation-prefer' + (state.prefer_separated ? ' btn-primary' : ' btn-outline-primary')
            + '" aria-pressed="' + (state.prefer_separated ? 'true' : 'false') + '" data-toggle="tooltip" data-placement="bottom" title="' + escape(title) + '">'
            + (state.prefer_separated ? '&#10003; ' : '') + escape(t('Prefer segregated')) + '</button>';
    }

    function setPreferSeparated(prefer) {
        state.prefer_separated = !!prefer;
        storePreference(state.prefer_separated);
        if (preferSeparated(state.graph, state.prefer_separated)) {
            cancelScheduledUpdate();
            update();
        } else {
            showPanel();
        }
    }

    /* starts a new route at latlng, turning navigation on if it is not */
    function startAt(latlng) {
        if (!state.active) {
            activate();
        }
        clear();
        setPoint('from', latlng);
    }

    function toggle() {
        if (state.active) {
            deactivate();
        } else {
            activate();
        }
    }

    function activate() {
        state.active = true;
        setButtonActive(true);
        loadGraph();
        update();
    }

    function deactivate() {
        state.active = false;
        document.body.classList.remove('navigation-half', 'navigation-controls-hidden');
        state.map.getContainer().classList.remove('navigating');
        setButtonActive(false);
        clear();
        renderLoading();
        rewriteLink();
        if (typeof closeSidebar == 'function') {
            closeSidebar();
        }
    }

    function setButtonActive(active) {
        if (state.button != null && state.button.button != undefined) {
            state.button.button.classList.toggle('navigation-active', active);
        }
    }

    function loadGraph() {
        if (state.graph != null || state.loading) {
            return;
        }
        state.loading = true;
        state.failed = false;
        var json = function(url) {
            return fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            }).then(function(response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            });
        };
        // the roads only improve routes, the layer alone is still enough to route on
        var support = state.config.support ? json('data/navigation').catch(function(error) {
            console.error('Navigation: supporting roads could not be loaded', error);
            return null;
        }) : Promise.resolve(null);
        Promise.all([json('data/layer/' + state.config.layer), support]).then(function(results) {
            var build = function() {
                try {
                    state.graph = buildGraph(results[0].paths || [], state.config, supportPaths(results[1], state.config.layer));
                    preferSeparated(state.graph, state.prefer_separated);
                } catch (error) {
                    console.error('Navigation: the network could not be built', error);
                    state.failed = true;
                }
                state.loading = false;
                update();
            };
            // building holds the page up for a moment, so the loading animation gets painted first
            window.requestAnimationFrame(function() {
                window.setTimeout(build, 50);
            });
        }).catch(function(error) {
            console.error('Navigation: layer ' + state.config.layer + ' could not be loaded', error);
            state.loading = false;
            state.failed = true;
            update();
        });
    }

    function onMapClick(e) {
        if (!state.active || e.target == undefined || typeof e.target.closest != 'function') {
            return;
        }
        // with both points placed a click opens what it hits again; A and B are dragged to change the route
        if (state.from != null && state.to != null) {
            return;
        }
        // A and B are dragged rather than clicked, and a cluster still zooms in to show what is in it
        if (e.target.closest('.leaflet-control, .leaflet-popup, .leaflet-marker-draggable, .marker-cluster')) {
            return;
        }
        // the end of a drag is not a click on the map
        if (state.down != null && Math.abs(e.clientX - state.down[0]) + Math.abs(e.clientY - state.down[1]) > 6) {
            return;
        }
        // a marker on the map is a place to go from or to, so the point goes exactly on it
        var icon = e.target.closest('.leaflet-marker-icon');
        var latlng = icon != null ? markerLatLng(icon) : state.map.mouseEventToLatLng(e);
        if (latlng == null) {
            return;
        }
        e.stopPropagation();
        e.preventDefault();
        setPoint(state.from == null ? 'from' : 'to', latlng);
    }

    /* the position of the map marker an icon element belongs to */
    function markerLatLng(icon) {
        var latlng = null;
        state.map.eachLayer(function(layer) {
            if (latlng == null && layer._icon === icon && typeof layer.getLatLng == 'function') {
                latlng = layer.getLatLng();
            }
        });
        return latlng;
    }

    function setPoint(which, latlng) {
        // a newly placed destination shows the whole route; moving or swapping the points keeps the view
        if (which == 'to' && state.to == null) {
            state.fit = true;
        }
        state[which] = latlng;
        if (state.markers[which] == undefined) {
            state.markers[which] = L.marker(latlng, {
                draggable: true,
                keyboard: false,
                // above the map's own markers, so one picked as start or end shows as A or B
                zIndexOffset: 1000,
                bubblingMouseEvents: false,
                icon: L.divIcon({
                    className: 'navigation-marker navigation-' + which,
                    html: which == 'from' ? 'A' : 'B',
                    iconSize: [26, 26]
                })
            }).on('drag', function(e) {
                // the route follows the marker while it is dragged
                state[which] = e.target.getLatLng();
                scheduleUpdate();
            }).on('dragend', function(e) {
                state[which] = e.target.getLatLng();
                cancelScheduledUpdate();
                update();
            }).addTo(state.points);
        } else {
            state.markers[which].setLatLng(latlng);
        }
        update();
    }

    function clear() {
        state.from = null;
        state.to = null;
        state.result = null;
        state.markers = {};
        state.points.clearLayers();
        state.routes.clearLayers();
    }

    function reverse() {
        if (state.from == null || state.to == null) {
            return;
        }
        var from = state.from;
        setPoint('from', state.to);
        setPoint('to', from);
    }

    function boundingBox() {
        return state.config.bounding_box || (window.core != undefined && core.config != undefined ? core.config.bounding_box : null);
    }

    /* opens the route a shared link carries in its n parameter */
    function readLink() {
        var hash = window.location.hash.replace(/^#/, '');
        if (!hash || hash.indexOf('|') != -1 || hash.toLowerCase().indexOf('%7c') != -1) {
            return;
        }
        var params = new URLSearchParams(hash);
        if (!params.get('n')) {
            return;
        }
        var points = decodePoints(params.get('n'), boundingBox(), 2);
        if (points == null) {
            return;
        }
        var from = L.latLng(points[0][0], points[0][1]);
        var to = L.latLng(points[1][0], points[1][1]);
        // straight to where the route is, so the layers, the network and the animation all load over it
        var focus = function() {
            state.map.fitBounds(L.latLngBounds([from, to]), {padding: [60, 60], maxZoom: 17, animate: false});
        };
        focus();
        // main.js sets the view from the link's map= once the page has loaded, which would move it away again
        if (document.readyState == 'loading') {
            document.addEventListener('DOMContentLoaded', focus);
        }
        // and once the route is known, the whole of it
        state.fit = true;
        activate();
        setPoint('from', from);
        setPoint('to', to);
    }

    /*
        The page's own link with the route added. The view is left out, the route is
        zoomed to when the link is opened; the layers stay, without them main.js would
        open the link with none. An open marker or path would compete for the sidebar.
    */
    /* the route as the value of n: compact, or plain coordinates for points outside the bounding box */
    function linkCode() {
        var points = [[state.from.lat, state.from.lng], [state.to.lat, state.to.lng]];
        var code = encodePoints(points, boundingBox());
        if (code == null) {
            code = points.map(function(point) {
                return point[0].toFixed(5) + ',' + point[1].toFixed(5);
            }).join(';');
        }
        return code;
    }

    function shareLink() {
        var code = linkCode();
        var hash = window.location.hash.replace(/^#/, '');
        var parts = hash.indexOf('|') != -1 ? [] : hash.split('&').filter(function(part) {
            var key = part.split('=')[0];
            return part && key != 'map' && key != 'm' && key != 'p' && key != 'n';
        });
        var has_layers = parts.some(function(part) {
            return part.indexOf('l=') === 0;
        });
        if (!has_layers && window.core != undefined && core.config != undefined && core.config.default_layers != undefined) {
            var layers = core.config.default_layers.filter(function(layer) {
                return layer != 'base';
            });
            if (layers.length) {
                parts.push('l=' + layers.join(','));
            }
        }
        parts.push('n=' + code);
        return window.location.href.split('#')[0] + '#' + parts.join('&');
    }

    function copy(text) {
        if (typeof copyText == 'function') {
            copyText(text);
        } else if (navigator.clipboard != undefined && navigator.clipboard.writeText != undefined) {
            navigator.clipboard.writeText(text);
        }
    }

    function onPanelClick(e) {
        if (e.target == undefined || typeof e.target.closest != 'function') {
            return;
        }
        if (e.target.closest('.navigation-prefer')) {
            setPreferSeparated(!state.prefer_separated);
        } else if (e.target.closest('.navigation-reverse')) {
            reverse();
        } else if (e.target.closest('.navigation-end')) {
            deactivate();
        } else if (e.target.closest('.navigation-step')) {
            focusStep(parseInt(e.target.closest('.navigation-step').getAttribute('data-step'), 10));
        } else if (e.target.closest('.navigation-share') && state.from != null && state.to != null) {
            var button = e.target.closest('.navigation-share');
            button.classList.add('clipboard');
            copy(shareLink());
            window.setTimeout(function() {
                button.classList.remove('clipboard');
            }, 1000);
        }
    }

    /*
        A drag moves the marker many times a second. A route takes a few dozen milliseconds, so it
        is worked out again once the marker has rested for a moment rather than on every move -
        and a drag that never rests still gets a fresh route every UPDATE_MAX_WAIT.
    */
    var UPDATE_DELAY = 100;
    var UPDATE_MAX_WAIT = 300;
    var update_timer = null;
    // when the oldest move still waiting for its route happened
    var update_waiting_since = null;

    function scheduleUpdate() {
        var now = Date.now();
        if (update_waiting_since == null) {
            update_waiting_since = now;
        }
        if (update_timer != null) {
            window.clearTimeout(update_timer);
        }
        var wait = Math.min(UPDATE_DELAY, Math.max(0, update_waiting_since + UPDATE_MAX_WAIT - now));
        update_timer = window.setTimeout(function() {
            update_timer = null;
            update_waiting_since = null;
            update();
        }, wait);
    }

    function cancelScheduledUpdate() {
        if (update_timer != null) {
            window.clearTimeout(update_timer);
            update_timer = null;
        }
        update_waiting_since = null;
    }

    function update() {
        if (!state.active) {
            return;
        }
        // the crosshair only while a point is still to be placed, with A and B set the map is the map again
        state.map.getContainer().classList.toggle('navigating', state.from == null || state.to == null);
        // the hover line under the pointer may be about to go
        if (typeof hideCrossSection == 'function') {
            hideCrossSection();
        }
        state.routes.clearLayers();
        state.highlight = null;
        state.result = null;
        if (state.graph != null && state.from != null && state.to != null) {
            state.result = route(state.graph, [state.from.lat, state.from.lng], [state.to.lat, state.to.lng]);
            if (!state.result.error) {
                draw(state.result);
            }
            if (state.fit) {
                state.fit = false;
                var bounds = L.latLngBounds([state.from, state.to]);
                if (!state.result.error) {
                    state.result.groups.forEach(function(group) {
                        bounds.extend(group.latlngs);
                    });
                }
                if (isMobile()) {
                    // the panel takes the bottom half and the buttons there step aside until the map is touched
                    document.body.classList.add('navigation-half', 'navigation-controls-hidden');
                }
                state.map.fitBounds(bounds, {paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + coveredBottom()]});
            }
        }
        showPanel();
        renderLoading();
        rewriteLink();
    }

    // the phone layout, where the panel is a sheet over the bottom of the map; the breakpoint main.css uses
    function isMobile() {
        return window.matchMedia != undefined && window.matchMedia('(max-width: 767.98px)').matches;
    }

    // how much of the bottom of the map the panel covers, so fitting the view keeps the route above it
    function coveredBottom() {
        if (!isMobile()) {
            return 0;
        }
        var sidebar = document.getElementById('sidebar');
        if (sidebar != null && sidebar.style.display == 'block' && sidebar.offsetHeight) {
            return sidebar.offsetHeight;
        }
        return document.body.classList.contains('navigation-half') ? Math.round(state.map.getSize().y / 2) : 0;
    }

    // the address bar follows the route, see the fragment parameter registered in init()
    function rewriteLink() {
        if (typeof scheduleFragmentRewrite == 'function') {
            scheduleFragmentRewrite();
        }
    }

    function draw(result) {
        var renderer = state.routes.renderer;
        var line = function(latlngs, class_name) {
            L.polyline(latlngs, {renderer: renderer, interactive: false, className: class_name}).addTo(state.routes);
        };
        line([[state.from.lat, state.from.lng], result.from], 'navigation-access');
        line([[state.to.lat, state.to.lng], result.to], 'navigation-access');
        result.groups.forEach(function(group) {
            line(group.latlngs, 'navigation-casing');
        });
        result.groups.forEach(function(group) {
            line(group.latlngs, 'navigation-line navigation-' + group.kind + (group.style ? ' navigation-' + group.style : ''));
        });
        /*
            The roads are not on the map, so their cross-section is shown from the route
            itself: a wide invisible line on top of each road stretch, which does not pass
            the pointer on to the map, so a path of the layer nearby does not take over.
        */
        if (typeof showCrossSection != 'function') {
            return;
        }
        result.groups.forEach(function(group) {
            if (group.path == null) {
                return;
            }
            L.polyline(group.latlngs, {
                renderer: renderer,
                interactive: true,
                bubblingMouseEvents: false,
                className: 'navigation-hover'
            }).on('mousemove', function(e) {
                showCrossSection(group.path, e.latlng);
            }).on('mouseout', function() {
                if (typeof hideCrossSection == 'function') {
                    hideCrossSection();
                }
            }).addTo(state.routes);
        });
    }

    var TURN_TEXT = {
        straight: 'Continue', slight_right: 'Slight right', right: 'Turn right',
        slight_left: 'Slight left', left: 'Turn left'
    };
    // how far the arrow's head bends off its stem, like ↴ and ↵ - 0 is straight on
    var TURN_ANGLE = {
        straight: 0, slight_right: 45, right: 90,
        slight_left: -45, left: -90
    };

    /*
        Plain one-colour drawings rather than arrow characters, which many fonts draw as
        emoji or not at all. They take the text colour.
    */
    var STEP_ICONS = {
        roundabout: '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/>',
        crossing: '<rect x="2" y="3" width="12" height="2.2"/><rect x="2" y="6.9" width="12" height="2.2"/><rect x="2" y="10.8" width="12" height="2.2"/>',
        gap: '<circle cx="3" cy="8" r="1.6"/><circle cx="8" cy="8" r="1.6"/><circle cx="13" cy="8" r="1.6"/>'
    };

    /*
        Turned with the SVG transform attribute rather than a CSS transform on the svg
        element, and sized with width and height attributes as well as CSS - both of which
        Safari has handled unreliably on inline svg.
    */
    function stepIcon(name, angle) {
        var content = STEP_ICONS[name];
        if (name == 'turn') {
            /*
                The stem comes up from below and the head bends off it towards where the route
                goes. A solid head reads at 16 pixels where two thin strokes run into the stem.
            */
            var line = ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
            /*
                Turned round, as the list reads downwards: straight on points down, and a turn bends the
                way it does for a rider heading down the list - right to the left of the screen.
            */
            content = '<g transform="rotate(180 8 8)">'
                + '<path d="M8 14.5V9"' + line + '/>'
                + '<g transform="rotate(' + (angle || 0) + ' 8 9)">'
                + '<path d="M8 9V5.5"' + line + '/>'
                + '<path d="M8 2.5L11.5 7H4.5z"/>'
                + '</g></g>';
        }
        return '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">' + content + '</svg>';
    }

    /*
        One line per step. The street is named after a colon rather than inside a sentence,
        so no language has to decline it.
    */
    function stepsHtml(steps) {
        if (steps == undefined || !steps.length) {
            return '';
        }
        var legend = legendEntries();
        /*
            What a step mostly is, as a line down the side of the list in the colour and style (full
            or dotted) of the layer's legend - orange, which the legend has not, for nothing. One
            step's line runs into the next, so the list reads as the route.
        */
        var mark = function(category) {
            if (category == null) {
                return '';
            }
            var entry = legend[category];
            var colour = entry != undefined && entry.cls ? entry.cls : 'navigation-swatch-' + category;
            return '<span class="navigation-step-bar ' + colour + (entry != undefined && entry.dotted ? ' navigation-step-bar-dotted' : '') + '"></span>';
        };
        var content = '<ol class="navigation-steps">';
        /*
            A step shows how long into the ride it comes where that has changed, and now and then how far too: the first step
            at least one spacing on from the last one that did (distanceSpacing), and the arrival always.
        */
        var total = steps.reduce(function(sum, step) {
            return sum + step.length;
        }, 0);
        var spacing = distanceSpacing(total);
        var travelled = 0;
        var elapsed = 0;
        var last_shown = 0;
        // a time is only shown where it has changed since the last one shown, the arrival always has it
        var last_time = null;
        steps.forEach(function(step, index) {
            var at = travelled;
            var at_time = elapsed;
            travelled += step.length;
            elapsed += step.time;
            // the distance small and before the time, the times in a column of their own so they line up
            var shown_distance = '';
            var shown_time = '';
            if (index > 0) {
                var time = formatTime(at_time);
                // not before the first whole minute of the ride
                if (step.type == 'arrive' || (time != last_time && Math.round(at_time / 60) >= 1)) {
                    shown_time = escape(time);
                    last_time = time;
                }
                if (step.type == 'arrive' || at - last_shown >= spacing) {
                    shown_distance = formatDistance(at);
                    last_shown = at;
                }
            }
            var progress = shown_distance || shown_time
                ? '<span class="navigation-step-length">' + shown_distance + '</span><span class="navigation-step-time">' + shown_time + '</span>'
                : '';
            // every kind of way the step goes along, already translated by waynames.js: "Obchodná (Pešia zóna)"
            var label = (step.labels || []).map(escape).join(', ');
            if (step.name) {
                label = '<strong>' + escape(step.name) + '</strong>' + (label ? ' (' + label + ')' : '');
            }
            var icon;
            var text;
            if (step.type == 'arrive') {
                // the same B as the destination marker on the map
                icon = '<span class="navigation-marker navigation-to navigation-step-marker">B</span>';
                text = escape(t('Arrive at the destination'));
            } else if (index == 0) {
                icon = '<span class="navigation-marker navigation-from navigation-step-marker">A</span>';
                text = escape(t('Start')) + ': ' + label;
            } else if (step.type == 'roundabout') {
                icon = stepIcon('roundabout');
                text = escape(t('Roundabout')) + ', ' + escape(t('exit')) + ' ' + step.exit;
            } else if (step.type == 'crossing') {
                icon = stepIcon('crossing');
                text = escape(t('Cross'));
            } else if (step.type == 'gap') {
                icon = stepIcon('gap');
                text = escape(t('Continue without a path'));
            } else {
                icon = stepIcon('turn', TURN_ANGLE[step.turn]);
                text = escape(t(TURN_TEXT[step.turn])) + ': ' + label;
            }
            content = content + '<li class="navigation-step" data-step="' + index + '">'
                + mark(step.category)
                + '<span class="navigation-step-icon">' + icon + '</span>'
                + '<span class="navigation-step-text">' + text + '</span>'
                + (progress ? '<span class="navigation-step-distance">' + progress + '</span>' : '')
                + '</li>';
        });
        return content + '</ol>';
    }

    /* zooms to a step and marks it on the route */
    function focusStep(index) {
        var result = state.result;
        if (result == null || result.steps == undefined || result.steps[index] == undefined) {
            return;
        }
        var step = result.steps[index];
        // a cross-section left open from hovering the route belongs to where the map was, not to the step
        if (typeof hideCrossSection == 'function') {
            hideCrossSection();
        }
        if (state.highlight != null) {
            state.routes.removeLayer(state.highlight);
        }
        state.highlight = L.polyline(step.latlngs, {
            renderer: state.routes.renderer,
            interactive: false,
            className: 'navigation-step-highlight'
        }).addTo(state.routes);
        if (step.latlngs.length > 1) {
            state.map.fitBounds(L.latLngBounds(step.latlngs), {paddingTopLeft: [60, 60], paddingBottomRight: [60, 60 + coveredBottom()], maxZoom: 18});
        } else {
            var zoom = Math.max(state.map.getZoom(), 17);
            // centred in the part of the map the panel leaves visible
            var point = state.map.project(step.latlngs[0], zoom).add([0, coveredBottom() / 2]);
            state.map.setView(state.map.unproject(point, zoom), zoom);
        }
        qsaSteps().forEach(function(element) {
            element.classList.toggle('active', parseInt(element.getAttribute('data-step'), 10) == index);
        });
    }

    function qsaSteps() {
        return Array.prototype.slice.call(document.querySelectorAll('#sidebar-content .navigation-step'));
    }

    var FLIGHTS = 12;
    var ARCS = ['navigation-arc-1', 'navigation-arc-2', 'navigation-arc-3', 'navigation-arc-4'];

    /*
        While a route with both ends is waiting for the network - a shared link opening, most
        often - dots fly across the map: from A to B when both are in view, across the middle
        otherwise. Each dot moves along its line and arcs off it with CSS transform animations
        only, which browsers keep running while the page is busy building.
    */
    function renderLoading() {
        var waiting = state.active && state.from != null && state.to != null && state.graph == null && !state.failed;
        if (!waiting) {
            if (state.loading_overlay != null && state.loading_overlay.parentNode) {
                state.loading_overlay.parentNode.removeChild(state.loading_overlay);
            }
            state.loading_overlay = null;
            return;
        }
        if (state.loading_overlay != null) {
            return;
        }
        var map = state.map;
        var size = map.getSize();
        var a = map.latLngToContainerPoint(state.from);
        var b = map.latLngToContainerPoint(state.to);
        var inside = function(point) {
            return point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y;
        };
        var along_route = inside(a) && inside(b) && a.distanceTo(b) > 40;
        var overlay = document.createElement('div');
        overlay.id = 'navigation-loading';
        var html = '';
        for (var i = 0; i < FLIGHTS; i++) {
            var from;
            var to;
            if (along_route) {
                from = {x: a.x + (Math.random() - 0.5) * 24, y: a.y + (Math.random() - 0.5) * 24};
                to = {x: b.x + (Math.random() - 0.5) * 24, y: b.y + (Math.random() - 0.5) * 24};
            } else {
                var direction = Math.random() * Math.PI * 2;
                var reach = Math.min(size.x, size.y) * (0.15 + Math.random() * 0.25);
                from = {x: size.x / 2 - Math.cos(direction) * reach, y: size.y / 2 - Math.sin(direction) * reach};
                to = {x: size.x / 2 + Math.cos(direction) * reach, y: size.y / 2 + Math.sin(direction) * reach};
            }
            var length = Math.round(Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)));
            var angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
            var duration = (1.6 + Math.random()).toFixed(2);
            // a negative delay starts a dot part way through its flight, so they are spread out from the first frame
            var timing = 'animation-duration: ' + duration + 's; animation-delay: -' + (Math.random() * duration).toFixed(2) + 's;';
            html = html + '<div class="navigation-flight" style="left: ' + Math.round(from.x) + 'px; top: ' + Math.round(from.y) + 'px; width: ' + length + 'px; transform: rotate(' + angle.toFixed(1) + 'deg);">'
                + '<div class="navigation-flight-x" style="' + timing + '">'
                + '<div class="navigation-flight-y ' + ARCS[i % ARCS.length] + '" style="' + timing + '">'
                + '<span class="navigation-flight-dot" style="' + timing + '"></span>'
                + '</div></div></div>';
        }
        // the label sits in the middle of the flights, kept clear of the map's edges
        var middle = along_route ? {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2} : {x: size.x / 2, y: size.y / 2};
        middle.x = Math.max(Math.min(160, size.x / 2), Math.min(size.x - Math.min(160, size.x / 2), middle.x));
        middle.y = Math.max(Math.min(50, size.y / 2), Math.min(size.y - Math.min(50, size.y / 2), middle.y));
        overlay.innerHTML = html + '<div class="navigation-loading-label" style="left: ' + Math.round(middle.x) + 'px; top: ' + Math.round(middle.y) + 'px;">' + escape(t('Finding the route…')) + '</div>';
        map.getContainer().appendChild(overlay);
        state.loading_overlay = overlay;
    }

    function showPanel() {
        if (typeof openSidebar != 'function') {
            return;
        }
        var content = '<h2>' + escape(t('Navigation')) + ' ' + preferButtonHtml();
        if (state.from != null && state.to != null) {
            content = content + '<button class="btn btn-lg btn-outline-dark float-right navigation-share" data-toggle="tooltip" data-placement="bottom" title="' + escape(t('Copy link to clipboard')) + '">' + SHARE_ICON + ' <span data-i18n="Share">' + escape(t('Share')) + '</span></button>';
        }
        content = content + '</h2>';
        var message = null;
        if (state.failed) {
            message = t('Paths could not be loaded');
        } else if (state.from == null) {
            message = t('Click on the map to set the start');
        } else if (state.to == null) {
            message = t('Click on the map to set the destination');
        } else if (state.graph == null) {
            message = t('Loading paths…');
        } else if (state.result != null && state.result.error == 'from') {
            message = t('The start is too far from the paths');
        } else if (state.result != null && state.result.error == 'to') {
            message = t('The destination is too far from the paths');
        } else if (state.result != null && state.result.error) {
            message = t('No route found');
        }
        if (message != null) {
            content = content + '<p>' + escape(message) + '</p>';
        }
        var result = state.result;
        if (result != null && !result.error) {
            // how long and how far, "~17 min (4,0 km)"
            content = content + '<p class="navigation-summary"><strong>~' + formatTime(result.time) + '</strong> (' + formatDistance(result.length) + ')</p>';
            // the route summed up in three lines, with how much of the route each is, longest first
            content = content + '<div class="navigation-legend-table">';
            SUMMARY.map(function(line) {
                return {key: line.key, label: line.label, metres: result.summary[line.key]};
            }).filter(function(line) {
                // only what the route actually has
                return line.metres >= 1;
            }).sort(function(a, b) {
                return b.metres - a.metres;
            }).forEach(function(line) {
                // bordered in the colour the route is drawn in on the map for that line
                content = content + '<div class="navigation-legend-row navigation-legend-' + line.key + '">'
                    + '<span class="navigation-legend-label">' + escape(t(line.label)) + '</span>'
                    + '<span class="navigation-legend-share">' + share(line.metres, result.length) + '</span>'
                    + '</div>';
            });
            content = content + '</div>' + stepsHtml(result.steps) + '<p class="text-secondary">' + escape(t('Drag A or B to change the route')) + '</p>';
        }
        content = content + '<p>';
        if (state.from != null && state.to != null) {
            content = content + '<button class="btn btn-sm btn-outline-primary navigation-reverse">⇅ ' + escape(t('Reverse')) + '</button> ';
        }
        content = content + '<button class="btn btn-sm btn-outline-danger navigation-end">' + escape(t('End navigation')) + '</button></p>';
        openSidebar(content);
    }

    return {
        init: init,
        buildGraph: buildGraph,
        route: route,
        preferSeparated: preferSeparated,
        score: score,
        directions: directions,
        supportPaths: supportPaths,
        encodePoints: encodePoints,
        decodePoints: decodePoints,
        defaults: DEFAULTS
    };
})();

if (typeof module != 'undefined' && module.exports) {
    module.exports = navigation;
}
