/*
    Turn by turn guidance along a route navigation.js has found: where on the route the
    rider is, how far the next manoeuvre is, and what to say when. Plain geometry over
    result.steps, no Leaflet and no browser, so it runs and is tested in Node as well.

    create(result) gives a tracker. Every position fix goes into tracker.update(fix), which
    answers with the state of the ride and the announcements due right now. Each announcement
    is made once, whatever the fixes do afterwards.

    fakeSource(result) plays a position along the route, the same shape the real GPS
    source in navigation.js has, for the demo page and for testing on a desk.
*/

var guidance = (function() {

    var DEFAULTS = {
        // fixes less precise than this (metres) are not trusted with the route
        max_accuracy: 50,
        // this far off the line, for this many fixes in a row, the rider has left the route
        off_route_distance: 40,
        off_route_fixes: 3,
        // the ride is over this close to the end
        arrive_distance: 25,
        // "in 200 metres turn right"
        prepare_distance: 200,
        // "turn right"
        now_distance: 50,
        // a manoeuvre this soon after another is said together with it: "turn right, then turn left"
        then_distance: 100,
        // a stretch this long after a manoeuvre is worth "continue for 800 metres"
        continue_distance: 150,
        // rails in the road are warned of this far before them
        rails_distance: 30,
        // how many segments ahead of the current one a fix may land on; a loop further on cannot pull the rider forward
        lookahead: 30,
        // the way ahead is taken over this many metres of route, so the map is not turned by every kink in the line
        ahead_distance: 40,
        /*
            The distances above are for riding at reference_speed (km/h). Faster, they stretch, so a turn is
            still said the same seconds ahead; slower, they shrink - within pace_range times the distance.
            A fix without a speed keeps the last pace. continue_distance is about the road, not the rider, and stays.
        */
        reference_speed: 13,
        pace_range: [0.6, 2]
    };

    var EARTH_DEGREE = 111320;

    function withDefaults(options) {
        var merged = {};
        for (var key in DEFAULTS) {
            merged[key] = options != null && options[key] != null ? options[key] : DEFAULTS[key];
        }
        return merged;
    }

    /*
        The route as one polyline in local metres: the steps share their end points, so every
        step after the first starts where the last one ended. points[i] = {x, y, lat, lon, at}
        with at the metres from the start, and starts[s] the metres at which step s begins.
    */
    function flatten(steps) {
        var points = [];
        var starts = [];
        var first = null;
        steps.forEach(function(step) {
            (step.latlngs || []).forEach(function(latlng) {
                if (first == null) {
                    first = latlng;
                }
            });
        });
        if (first == null) {
            return {points: points, starts: starts, total: 0, kx: 1, ky: 1};
        }
        var ky = EARTH_DEGREE;
        var kx = EARTH_DEGREE * Math.cos(first[0] * Math.PI / 180);
        var at = 0;
        steps.forEach(function(step, index) {
            starts[index] = at;
            (step.latlngs || []).forEach(function(latlng) {
                var point = {lat: latlng[0], lon: latlng[1], x: latlng[1] * kx, y: latlng[0] * ky, at: at};
                var last = points[points.length - 1];
                if (last != undefined) {
                    var d = Math.sqrt(Math.pow(point.x - last.x, 2) + Math.pow(point.y - last.y, 2));
                    if (d < 0.01) {
                        return;
                    }
                    at += d;
                    point.at = at;
                }
                points.push(point);
            });
        });
        return {points: points, starts: starts, total: at, kx: kx, ky: ky};
    }

    // nearest point of segment i to (x, y): {d, t, at} with t 0..1 along the segment
    function project(line, i, x, y) {
        var a = line.points[i];
        var b = line.points[i + 1];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var length2 = dx * dx + dy * dy;
        var t = length2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / length2 : 0;
        t = Math.max(0, Math.min(1, t));
        var px = a.x + t * dx;
        var py = a.y + t * dy;
        return {
            d: Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2)),
            t: t,
            at: a.at + t * (b.at - a.at),
            lat: py / line.ky,
            lon: px / line.kx
        };
    }

    // compass bearing of segment i, 0 north and 90 east
    function bearing(line, i) {
        var a = line.points[i];
        var b = line.points[Math.min(i + 1, line.points.length - 1)];
        return (Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI + 360) % 360;
    }

    // a distance as it is spoken: under 100 m to the nearest ten, then to the nearest fifty, then to 100 m
    function roundDistance(metres) {
        if (metres < 100) {
            return Math.max(10, Math.round(metres / 10) * 10);
        }
        if (metres < 1000) {
            return Math.round(metres / 50) * 50;
        }
        return Math.round(metres / 100) * 100;
    }

    /*
        @result what navigation.route() returned, with steps
        @return tracker with update(fix) and remaining(), see update()
    */
    function create(result, options) {
        var config = withDefaults(options);
        var steps = result != null && Array.isArray(result.steps) ? result.steps : [];
        var line = flatten(steps);
        var segments = Math.max(0, line.points.length - 1);
        var tracker = {
            config: config,
            steps: steps,
            total: line.total,
            // index of the segment the rider was last on
            segment: 0,
            // metres along the route
            along: 0,
            // the step the rider is on
            step: 0,
            started: false,
            done: false,
            off_route: false,
            off_count: 0,
            // how the announcement distances are stretched for the rider's speed, see pace()
            pace: 1,
            // per step: which announcements were made
            said: steps.map(function() {
                return {};
            })
        };

        // the point of the route this many metres along, in local metres
        function pointAt(along) {
            if (line.points.length < 2) {
                return null;
            }
            var i = 0;
            while (i < line.points.length - 2 && line.points[i + 1].at < along) {
                i++;
            }
            var a = line.points[i];
            var b = line.points[i + 1];
            var span = b.at - a.at;
            var t = span > 0 ? Math.max(0, Math.min(1, (along - a.at) / span)) : 0;
            return {x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y)};
        }

        // the step the rider is on at this many metres along
        function stepAt(along) {
            var step = 0;
            for (var s = 0; s < steps.length; s++) {
                if (line.starts[s] <= along + 0.01) {
                    step = s;
                } else {
                    break;
                }
            }
            // the arrival step has no length, one is on the step before it until the end
            return Math.min(step, Math.max(0, steps.length - 2));
        }

        // seconds of riding left from this many metres along, from the step times the route was found with
        function timeLeft(along) {
            var seconds = 0;
            for (var s = 0; s < steps.length; s++) {
                var start = line.starts[s];
                var end = s + 1 < steps.length ? line.starts[s + 1] : line.total;
                if (end <= along || end <= start) {
                    continue;
                }
                var fraction = along > start ? (end - along) / (end - start) : 1;
                seconds += (steps[s].time || 0) * fraction;
            }
            return seconds;
        }

        /*
            Sets how far ahead things are said from the speed of a fix (m/s), smoothed so one odd
            reading does not move the announcements about.
        */
        function pace(fix) {
            if (fix == null || typeof fix.speed != 'number' || !isFinite(fix.speed) || fix.speed < 0) {
                return;
            }
            var reference = (config.reference_speed || 13) / 3.6;
            var range = config.pace_range || [0.6, 2];
            var wanted = Math.max(range[0], Math.min(range[1], fix.speed / reference));
            tracker.pace = tracker.pace + (wanted - tracker.pace) * 0.3;
        }

        // metres at the reference speed, as they are at the rider's
        function paced(metres) {
            return metres * tracker.pace;
        }

        /*
            The manoeuvre of step s, said now, and the one right after it when it comes too soon
            for an announcement of its own.
        */
        function now(s, announcements) {
            var event = {kind: 'now', step: s};
            var next = s + 1;
            if (next < steps.length && line.starts[next] - line.starts[s] < paced(config.then_distance) && steps[s].type != 'arrive' && steps[next].type != 'arrive') {
                event.then = next;
                // said together with this one, and not again on its own a few metres on
                tracker.said[next].prepare = true;
                tracker.said[next].now = true;
            }
            tracker.said[s].now = true;
            announcements.push(event);
        }

        function announce(fix_along, announcements) {
            var s = tracker.step;
            // rails in the road ahead: said once, just before them, not again on the next street with them
            var rails_at = line.starts[s] + (steps[s].rails_at || 0);
            if (steps[s].rails && !tracker.said[s].rails && !(s > 0 && steps[s - 1].rails) && fix_along >= rails_at - paced(config.rails_distance)) {
                tracker.said[s].rails = true;
                announcements.push({kind: 'rails', step: s});
            }
            if (!tracker.started) {
                tracker.started = true;
                // the first words: what to ride along - unless the first manoeuvre is so close that its words come at once
                var first_next = s + 1 < steps.length ? line.starts[s + 1] - fix_along : line.total - fix_along;
                if (first_next >= paced(config.prepare_distance + config.now_distance)) {
                    announcements.push({kind: 'start', step: s, metres: roundDistance(first_next)});
                }
                tracker.said[s]['continue'] = true;
            }
            // a manoeuvre passed between two fixes without being said is said now, late is better than never
            if (s > 0 && !tracker.said[s].now && steps[s].type != 'arrive') {
                now(s, announcements);
            }
            var next = s + 1;
            if (next >= steps.length) {
                return;
            }
            var to_next = line.starts[next] - fix_along;
            var length = line.starts[next] - line.starts[s];
            // a long way to ride before anything happens: said once, when the step is entered
            if (!tracker.said[s]['continue']) {
                tracker.said[s]['continue'] = true;
                if (to_next >= config.continue_distance + paced(config.prepare_distance) && !tracker.said[next].prepare) {
                    announcements.push({kind: 'continue', step: s, metres: roundDistance(to_next)});
                }
            }
            if (!tracker.said[next].prepare && to_next <= paced(config.prepare_distance) && length >= paced(config.prepare_distance + config.now_distance)) {
                tracker.said[next].prepare = true;
                announcements.push({kind: 'prepare', step: next, metres: roundDistance(Math.max(to_next, paced(config.now_distance)))});
            }
            // the arrival is its own announcement, made at the end itself
            if (!tracker.said[next].now && to_next <= paced(config.now_distance) && steps[next].type != 'arrive') {
                now(next, announcements);
            }
        }

        /*
            @fix {lat, lon, accuracy?, heading?, speed?}
            @return {
                accepted, off_route, arrived, done,
                step, next, along, distance (metres to the next manoeuvre), remaining, remaining_time,
                snapped [lat, lon], bearing (of the route where the rider is), ahead (bearing to the next manoeuvre),
                announcements [{kind, step, metres?, then?}]
            }
            kinds: start, continue, prepare, now, rails, off_route, arrive
        */
        function update(fix) {
            var announcements = [];
            var answer = function(accepted) {
                var next = Math.min(tracker.step + 1, steps.length - 1);
                var distance = steps.length > 1 ? Math.max(0, (next < steps.length ? line.starts[next] : line.total) - tracker.along) : 0;
                /*
                    The way ahead as a compass bearing: from where the rider is to the route ahead_distance
                    further on - the line underfoot points up, without the small kinks in it turning the map.
                    It stops at the next corner while that is still a little way off, so a long street stays
                    straight up to the end; close to the corner it looks through it, so the map turns in one go
                    at a short jog rather than twice in a few metres.
                */
                var ahead = null;
                if (tracker.snapped != null && steps.length > 1) {
                    var corner = next < steps.length ? line.starts[next] : line.total;
                    var reach = tracker.along + config.ahead_distance;
                    if (corner - tracker.along >= config.ahead_distance / 2) {
                        reach = Math.min(corner, reach);
                    }
                    var target = pointAt(reach);
                    if (target != null) {
                        var dx = target.x - tracker.snapped[1] * line.kx;
                        var dy = target.y - tracker.snapped[0] * line.ky;
                        if (dx * dx + dy * dy > 4) {
                            ahead = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
                        }
                    }
                }
                return {
                    ahead: ahead,
                    accepted: accepted,
                    off_route: tracker.off_route,
                    arrived: tracker.done,
                    done: tracker.done,
                    step: tracker.step,
                    next: next,
                    along: tracker.along,
                    distance: distance,
                    remaining: Math.max(0, line.total - tracker.along),
                    remaining_time: timeLeft(tracker.along),
                    snapped: tracker.snapped || null,
                    bearing: bearing(line, Math.min(tracker.segment, Math.max(0, segments - 1))),
                    announcements: announcements
                };
            };
            if (tracker.done || segments < 1 || fix == null) {
                return answer(false);
            }
            pace(fix);
            if (fix.accuracy != null && fix.accuracy > config.max_accuracy) {
                return answer(false);
            }
            var x = fix.lon * line.kx;
            var y = fix.lat * line.ky;
            // the nearest segment near the one the rider was on; a further one only wins clearly, so a corner is not left early
            var best = null;
            var end = Math.min(segments - 1, tracker.segment + config.lookahead);
            for (var i = tracker.segment; i <= end; i++) {
                var candidate = project(line, i, x, y);
                if (best == null || candidate.d < best.d - 5) {
                    best = candidate;
                    best.segment = i;
                }
            }
            if (best.d > config.off_route_distance) {
                // maybe the rider took a shortcut and is back on the route further on
                var rejoined = null;
                for (var j = end + 1; j < segments; j++) {
                    var again = project(line, j, x, y);
                    if (again.d <= config.off_route_distance && (rejoined == null || again.d < rejoined.d)) {
                        rejoined = again;
                        rejoined.segment = j;
                    }
                }
                if (rejoined != null) {
                    best = rejoined;
                }
            }
            if (best.d > config.off_route_distance) {
                tracker.off_count++;
                // the very first fix decides at once, later ones may be a moment's noise
                if (!tracker.started || tracker.off_count >= config.off_route_fixes) {
                    if (!tracker.off_route) {
                        tracker.off_route = true;
                        // leaving the route is worth words; never having been on it - a fresh route after a reroute - is not
                        if (tracker.started) {
                            announcements.push({kind: 'off_route', step: tracker.step});
                        }
                    }
                }
                return answer(true);
            }
            tracker.off_count = 0;
            tracker.off_route = false;
            tracker.segment = best.segment;
            tracker.along = best.at;
            tracker.snapped = [best.lat, best.lon];
            tracker.step = stepAt(best.at);
            if (line.total - best.at <= config.arrive_distance) {
                tracker.done = true;
                tracker.along = line.total;
                tracker.step = steps.length - 1;
                var last = steps.length - 1;
                if (!tracker.said[last].now) {
                    tracker.said[last].now = true;
                    announcements.push({kind: 'arrive', step: last});
                }
                return answer(true);
            }
            announce(best.at, announcements);
            return answer(true);
        }

        tracker.update = update;
        /*
            Puts the rider back this many metres along the route, and forgets the announcements made
            past that point, so they come again - for trying a stretch over on the demo page.
        */
        tracker.rewind = function(metres) {
            tracker.along = Math.max(0, tracker.along - metres);
            tracker.segment = 0;
            while (tracker.segment < segments - 1 && line.points[tracker.segment + 1].at < tracker.along) {
                tracker.segment++;
            }
            tracker.step = stepAt(tracker.along);
            tracker.done = false;
            tracker.off_route = false;
            tracker.off_count = 0;
            for (var s = 0; s < steps.length; s++) {
                if (line.starts[s] > tracker.along) {
                    tracker.said[s] = {};
                }
            }
            // the step the rider is back on gets its long-stretch words again as well
            tracker.said[tracker.step].now = tracker.said[tracker.step].now && line.starts[tracker.step] <= tracker.along;
            return tracker.along;
        };
        tracker.remaining = function() {
            return Math.max(0, line.total - tracker.along);
        };
        return tracker;
    }

    /*
        A position moving along the route, {start(callback), stop()} like the GPS source, one fix
        a second of ride time. speed in km/h, multiplier speeds the clock up (the fixes come faster,
        not further apart), offset (metres) moves the
        rider off the route to the right, so leaving it can be tried, setRoute() follows a new route.
    */
    function fakeSource(result, options) {
        var settings = {
            speed: 15,
            multiplier: 1,
            interval: 1000,
            jitter: 3,
            accuracy: 8,
            offset: 0
        };
        for (var key in options || {}) {
            if (options[key] != null) {
                settings[key] = options[key];
            }
        }
        var source = {
            line: null,
            along: 0,
            timer: null,
            paused: false,
            callback: null,
            ended: false,
            // fixes still sent once the end is reached, so the arrival is not missed
            after_end: 0
        };

        function place(along) {
            var line = source.line;
            var i = 0;
            while (i < line.points.length - 2 && line.points[i + 1].at < along) {
                i++;
            }
            var a = line.points[i];
            var b = line.points[Math.min(i + 1, line.points.length - 1)];
            var span = b.at - a.at;
            var t = span > 0 ? Math.max(0, Math.min(1, (along - a.at) / span)) : 0;
            var heading = bearing(line, i);
            var rad = heading * Math.PI / 180;
            // to the right of the direction of travel, plus a little noise
            var x = a.x + t * (b.x - a.x) + Math.cos(rad) * settings.offset + (Math.random() - 0.5) * settings.jitter;
            var y = a.y + t * (b.y - a.y) - Math.sin(rad) * settings.offset + (Math.random() - 0.5) * settings.jitter;
            return {
                lat: y / line.ky,
                lon: x / line.kx,
                accuracy: settings.accuracy,
                heading: heading,
                speed: settings.speed / 3.6,
                time: Date.now()
            };
        }

        function tick() {
            if (source.paused || source.callback == null || source.line == null) {
                return;
            }
            if (source.along >= source.line.total) {
                source.along = source.line.total;
                if (source.after_end++ > 2) {
                    source.ended = true;
                    stop();
                    return;
                }
            }
            var fix = place(source.along);
            fix.along = source.along;
            source.callback(fix);
            source.along += settings.speed / 3.6 * settings.interval / 1000;
        }

        function start(callback) {
            source.callback = callback;
            if (source.line == null) {
                setRoute(result);
            }
            stopTimer();
            // a fix every interval of ride time, the clock running multiplier times faster
            source.timer = setInterval(tick, Math.max(20, settings.interval / settings.multiplier));
            tick();
        }

        function stopTimer() {
            if (source.timer != null) {
                clearInterval(source.timer);
                source.timer = null;
            }
        }

        function stop() {
            stopTimer();
            source.callback = null;
        }

        // a new route: carries on from the point of it nearest to where the rider was
        function setRoute(new_result) {
            var was = source.line != null ? place(source.along) : null;
            source.line = flatten(new_result != null && Array.isArray(new_result.steps) ? new_result.steps : []);
            source.along = 0;
            source.after_end = 0;
            if (was != null && source.line.points.length > 1) {
                var x = (was.lon) * source.line.kx;
                var y = (was.lat) * source.line.ky;
                var best = null;
                for (var i = 0; i < source.line.points.length - 1; i++) {
                    var candidate = project(source.line, i, x, y);
                    if (best == null || candidate.d < best.d) {
                        best = candidate;
                    }
                }
                source.along = best.at;
            }
        }

        return {
            start: start,
            stop: stop,
            pause: function() {
                source.paused = true;
            },
            resume: function() {
                source.paused = false;
            },
            setMultiplier: function(multiplier) {
                settings.multiplier = multiplier;
                if (source.timer != null) {
                    start(source.callback);
                }
            },
            setOffset: function(metres) {
                settings.offset = metres;
            },
            back: function(metres) {
                source.along = Math.max(0, source.along - metres);
                source.after_end = 0;
                source.ended = false;
            },
            setRoute: setRoute,
            position: function() {
                return source.line != null ? place(source.along) : null;
            },
            fake: true
        };
    }

    return {
        create: create,
        fakeSource: fakeSource,
        flatten: flatten,
        roundDistance: roundDistance,
        defaults: DEFAULTS
    };
})();

if (typeof module != 'undefined' && module.exports) {
    module.exports = guidance;
}
