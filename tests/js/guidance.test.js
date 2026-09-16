/*
    node --test tests/js

    A made up route on a flat grid near Bratislava, walked with fixes a few metres apart,
    checking what the tracker says and when.
*/

var test = require('node:test');
var assert = require('node:assert');
var guidance = require('../../public/js/guidance.js');

var LAT = 48.15;
var LON = 17.11;
var DEG_Y = 111320;
var DEG_X = 111320 * Math.cos(LAT * Math.PI / 180);

// metres east and north of the origin as [lat, lon]
function at(x, y) {
    return [LAT + y / DEG_Y, LON + x / DEG_X];
}

function fix(x, y, accuracy) {
    var latlng = at(x, y);
    return {lat: latlng[0], lon: latlng[1], accuracy: accuracy == undefined ? 5 : accuracy};
}

/*
    Start at the origin, 500 m east on Hlavná, right turn 300 m south on Krátka, left turn 60 m east on
    a footway, then 400 m north on Dlhá to the end. The steps share their corner points like the router's do.
*/
function route() {
    var steps = [
        {type: 'street', name: 'Hlavná', labels: [], turn: 'straight', length: 500, time: 500 / (13 / 3.6), latlngs: [at(0, 0), at(250, 0), at(500, 0)]},
        {type: 'street', name: 'Krátka', labels: [], turn: 'right', length: 300, time: 300 / (13 / 3.6), latlngs: [at(500, 0), at(500, -300)]},
        {type: 'footway', name: '', labels: ['Footway'], turn: 'left', length: 60, time: 60 / (13 / 3.6), latlngs: [at(500, -300), at(560, -300)]},
        {type: 'street', name: 'Dlhá', labels: [], turn: 'left', length: 400, time: 400 / (13 / 3.6), latlngs: [at(560, -300), at(560, 100)]},
        {type: 'arrive', name: '', labels: [], turn: 'straight', length: 0, time: 0, latlngs: [at(560, 100)]}
    ];
    return {steps: steps, length: 1260, time: 1260 / (13 / 3.6)};
}

// rides the route, every 5 m, collecting announcements as "kind:step[:then]" with the metres they came at
function ride(tracker, path, step_metres) {
    var said = [];
    var d = 0;
    for (var i = 0; i < path.length - 1; i++) {
        var a = path[i];
        var b = path[i + 1];
        var length = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
        for (var s = 0; s <= length; s += step_metres || 5) {
            var x = a[0] + (b[0] - a[0]) * s / length;
            var y = a[1] + (b[1] - a[1]) * s / length;
            var event = tracker.update(fix(x, y));
            event.announcements.forEach(function(announcement) {
                said.push({key: announcement.kind + ':' + announcement.step + (announcement.then != undefined ? ':' + announcement.then : ''), at: Math.round(d + s), metres: announcement.metres});
            });
            if (event.done) {
                return said;
            }
        }
        d += length;
    }
    return said;
}

test('the route is flattened with the steps starting where they do', function() {
    var line = guidance.flatten(route().steps);
    assert.strictEqual(Math.round(line.total), 1260);
    assert.deepStrictEqual(line.starts.map(Math.round), [0, 500, 800, 860, 1260]);
    // the shared corner points are not doubled
    assert.strictEqual(line.points.length, 6);
});

test('announcements come once each, in order, at the right distances', function() {
    var tracker = guidance.create(route());
    var said = ride(tracker, [[0, 0], [500, 0], [500, -300], [560, -300], [560, 100]]);
    var keys = said.map(function(s) {
        return s.key;
    });
    assert.deepStrictEqual(keys, [
        'start:0',
        'prepare:1',
        'now:1',
        // Krátka is 300 m: too short for "continue for 300 m" and "in 200 m" both
        'prepare:2',
        // the footway is short: the turn onto Dlhá is said with the turn onto it, and not again
        'now:2:3',
        'continue:3',
        'prepare:4',
        'arrive:4'
    ]);
    var by = {};
    said.forEach(function(s) {
        by[s.key] = s;
    });
    assert.strictEqual(by['start:0'].metres, 500);
    assert.ok(by['prepare:1'].at >= 295 && by['prepare:1'].at <= 305, 'prepared about 200 m before the turn, was at ' + by['prepare:1'].at);
    assert.strictEqual(by['prepare:1'].metres, 200);
    assert.ok(by['now:1'].at >= 450 && by['now:1'].at <= 460, 'turn said 50 m before it, was at ' + by['now:1'].at);
    assert.ok(by['continue:3'].at >= 860 && by['continue:3'].at <= 870);
    assert.strictEqual(by['continue:3'].metres, 400);
    assert.ok(by['arrive:4'].at >= 1235 && by['arrive:4'].at <= 1260);
    assert.ok(tracker.done);
});

test('a stretch just after a turn is not both continued and prepared', function() {
    // 500 m, right, 250 m, right, 500 m: the 250 m stretch gets a prepare only, no continue
    var steps = [
        {type: 'street', name: 'A', labels: [], turn: 'straight', length: 500, time: 100, latlngs: [at(0, 0), at(500, 0)]},
        {type: 'street', name: 'B', labels: [], turn: 'right', length: 250, time: 50, latlngs: [at(500, 0), at(500, -250)]},
        {type: 'street', name: 'C', labels: [], turn: 'right', length: 500, time: 100, latlngs: [at(500, -250), at(0, -250)]},
        {type: 'arrive', name: '', labels: [], turn: 'straight', length: 0, time: 0, latlngs: [at(0, -250)]}
    ];
    var tracker = guidance.create({steps: steps});
    var keys = ride(tracker, [[0, 0], [500, 0], [500, -250], [0, -250]]).map(function(s) {
        return s.key;
    });
    assert.deepStrictEqual(keys, ['start:0', 'prepare:1', 'now:1', 'prepare:2', 'now:2', 'continue:2', 'prepare:3', 'arrive:3']);
});

test('the distance to the next manoeuvre and the remaining route follow the rider', function() {
    var tracker = guidance.create(route());
    var event = tracker.update(fix(100, 2));
    assert.strictEqual(event.accepted, true);
    assert.strictEqual(event.step, 0);
    assert.strictEqual(event.next, 1);
    assert.strictEqual(Math.round(event.distance), 400);
    assert.strictEqual(Math.round(event.remaining), 1160);
    assert.ok(Math.abs(event.remaining_time - 1160 / (13 / 3.6)) < 1);
    assert.strictEqual(Math.round(event.bearing), 90);
    assert.strictEqual(Math.round((event.snapped[1] - LON) * DEG_X), 100);
    // snapped onto the line
    assert.ok(Math.abs(event.snapped[0] - LAT) * DEG_Y < 0.01);
});

test('an imprecise fix is ignored', function() {
    var tracker = guidance.create(route());
    tracker.update(fix(100, 0));
    var event = tracker.update(fix(300, 0, 80));
    assert.strictEqual(event.accepted, false);
    assert.strictEqual(Math.round(event.along), 100);
});

test('progress does not jump forward where the route passes close to itself', function() {
    // a hairpin: 200 m east, 20 m south, 200 m back west; halfway east the rider is 20 m from the way back
    var steps = [
        {type: 'street', name: 'Out', labels: [], turn: 'straight', length: 200, time: 40, latlngs: [at(0, 0), at(200, 0)]},
        {type: 'street', name: 'Link', labels: [], turn: 'right', length: 20, time: 4, latlngs: [at(200, 0), at(200, -20)]},
        {type: 'street', name: 'Back', labels: [], turn: 'right', length: 200, time: 40, latlngs: [at(200, -20), at(0, -20)]},
        {type: 'arrive', name: '', labels: [], turn: 'straight', length: 0, time: 0, latlngs: [at(0, -20)]}
    ];
    var tracker = guidance.create({steps: steps});
    tracker.update(fix(50, 0));
    // a wobble 12 m south of the outward leg is still nearer to it than to the way back
    var event = tracker.update(fix(100, -12));
    assert.strictEqual(event.step, 0);
    assert.strictEqual(Math.round(event.along), 100);
});

test('leaving the route is reported after a few fixes, and once', function() {
    var tracker = guidance.create(route());
    tracker.update(fix(100, 0));
    var events = [fix(150, 60), fix(160, 70), fix(170, 80), fix(180, 90)].map(function(f) {
        return tracker.update(f);
    });
    assert.deepStrictEqual(events.map(function(e) {
        return e.off_route;
    }), [false, false, true, true]);
    var announced = events.map(function(e) {
        return e.announcements.map(function(a) {
            return a.kind;
        });
    });
    assert.deepStrictEqual(announced, [[], [], ['off_route'], []]);
    // back on the route: forgiven at once
    var back = tracker.update(fix(200, 0));
    assert.strictEqual(back.off_route, false);
    assert.strictEqual(Math.round(back.along), 200);
});

test('the first fix far from the route is off route at once, without a word', function() {
    var tracker = guidance.create(route());
    var event = tracker.update(fix(100, 200));
    assert.strictEqual(event.off_route, true);
    assert.deepStrictEqual(event.announcements, []);
});

test('no start words when the first turn is close', function() {
    var tracker = guidance.create(route());
    // 150 m before the corner: the warning is due at once, a start line as well would be two at once
    var event = tracker.update(fix(350, 0));
    assert.deepStrictEqual(event.announcements.map(function(a) {
        return a.kind;
    }), ['prepare']);
});

test('a rider back on the route further along is found there', function() {
    var tracker = guidance.create(route());
    tracker.update(fix(100, 0));
    // a shortcut straight to Dlhá, well past the lookahead of the segments around
    var event = tracker.update(fix(560, 0));
    assert.strictEqual(event.off_route, false);
    assert.strictEqual(event.step, 3);
    assert.strictEqual(Math.round(event.along), 1160);
});

test('a manoeuvre jumped over between two fixes is still said', function() {
    var tracker = guidance.create(route());
    tracker.update(fix(100, 0));
    // from 60 m before the corner straight to 20 m past it
    tracker.update(fix(440, 0));
    var event = tracker.update(fix(500, -20));
    assert.strictEqual(event.step, 1);
    assert.deepStrictEqual(event.announcements.map(function(a) {
        return a.kind + ':' + a.step;
    }), ['now:1']);
});

test('rails are warned of once per stretch of them', function() {
    var r = route();
    r.steps[1].rails = true;
    r.steps[2].rails = true;
    var tracker = guidance.create(r);
    var keys = ride(tracker, [[0, 0], [500, 0], [500, -300], [560, -300], [560, 100]]).map(function(s) {
        return s.key;
    }).filter(function(key) {
        return key.indexOf('rails') == 0;
    });
    assert.deepStrictEqual(keys, ['rails:1']);
});

test('the fake source walks the route and reaches the end', function(t, done) {
    var source = guidance.fakeSource(route(), {speed: 90, multiplier: 100, interval: 1000, jitter: 0});
    var tracker = guidance.create(route());
    var fixes = 0;
    var arrived = false;
    source.start(function(fix) {
        fixes++;
        var event = tracker.update(fix);
        if (event.arrived) {
            arrived = true;
            source.stop();
            assert.ok(fixes > 10);
            done();
        }
    });
    setTimeout(function() {
        if (!arrived) {
            source.stop();
            done(new Error('did not arrive, ' + fixes + ' fixes'));
        }
    }, 2000);
});

test('the fake source can be moved off the route and follow a new one', function() {
    var source = guidance.fakeSource(route(), {jitter: 0});
    source.setRoute(route());
    source.setOffset(60);
    var position = source.position();
    // heading east at the start, so 60 m to the right is 60 m south
    assert.strictEqual(Math.round((position.lat - LAT) * DEG_Y), -60);
    source.setOffset(0);
    // a new route beginning where Krátka does: the rider is placed on its nearest point
    var later = route();
    later.steps = later.steps.slice(1);
    source.setRoute(later);
    var moved = source.position();
    assert.strictEqual(Math.round((moved.lon - LON) * DEG_X), 500);
});

test('spoken distances are rounded', function() {
    assert.strictEqual(guidance.roundDistance(4), 10);
    assert.strictEqual(guidance.roundDistance(47), 50);
    assert.strictEqual(guidance.roundDistance(212), 200);
    assert.strictEqual(guidance.roundDistance(1249), 1200);
});
