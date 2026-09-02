/*
    Draws a street's cross-section from its OSM tags, as seen looking along the
    way's direction. Left in the drawing is left along the way.

    The cycling channels (form, direction, separation) are already resolved
    server side by CyclewayNormalizer and arrive on path.sides, so this file only
    lays out the carriageway around them and paints the result. It has no Leaflet
    dependency on purpose - it is a pure function from a path to an SVG string.
*/

var crossSection = (function() {

    var FILL = {
        footway: 'var(--xs-foot)',
        cycle: 'var(--xs-cycle)',
        motor: 'var(--xs-asphalt)',
        busway: 'var(--xs-transit)',
        pedestrian: 'var(--xs-foot)',
        crossing: 'var(--xs-asphalt)',
        tramway: 'var(--xs-asphalt)',
        parking: 'var(--xs-parking)',
        unknown: 'url(#xs-hatch)'
    };

    /*
        A crossing is tagged on the way that carries it rather than as a value of its
        own, and in several places at once - footway=crossing, cycleway=crossing, or
        path=crossing - so all of them are checked.
    */
    function isCrossing(tags) {
        return tags.footway == 'crossing'
            || tags.cycleway == 'crossing'
            || tags.path == 'crossing'
            || tags['cycleway:left'] == 'crossing'
            || tags['cycleway:right'] == 'crossing'
            || tags['cycleway:both'] == 'crossing';
    }

    /* who the crossing is for, which is what its Slovak name turns on */
    function crossingUsers(tags) {
        var bicycle = tags.bicycle;
        var foot = tags.foot;
        var rides = bicycle == 'designated' || bicycle == 'yes' || tags.cycleway == 'crossing'
            || tags['cycleway:left'] == 'crossing' || tags['cycleway:right'] == 'crossing'
            || tags['cycleway:both'] == 'crossing' || tags.highway == 'cycleway';
        var walks = foot == 'designated' || foot == 'yes' || tags.footway == 'crossing'
            || tags.highway == 'footway' || tags.highway == 'path' || tags.highway == 'pedestrian';
        if (foot == 'no') {
            walks = false;
        }
        if (bicycle == 'no' || bicycle == 'dismount') {
            rides = false;
        }
        return {rides: rides, walks: walks};
    }

    function crossingLabel(tags) {
        var users = crossingUsers(tags);
        if (users.rides && users.walks) {
            return i18n('Pedestrian and cycle crossing');
        }
        if (users.rides) {
            return i18n('Cycle crossing');
        }
        return i18n('Pedestrian crossing');
    }

    /*
        What a way that is itself the infrastructure is called. Shared by the heading and
        by the slot labels, so the two always say the same thing.
    */
    function pathLabel(tags) {
        if (isCrossing(tags)) {
            return crossingLabel(tags);
        }
        if (tags.railway == 'tram') {
            return (tags.bicycle == 'yes' || tags.bicycle == 'designated')
                ? i18n('Tram & bicycle access') : i18n('Tram line');
        }
        if (tags.highway == 'pedestrian') {
            return i18n('Pedestrian zone');
        }
        var riders = tags.bicycle == 'yes' || tags.bicycle == 'designated';
        if (tags.highway == 'cycleway') {
            return i18n('Segregated bike lane');
        }
        if (riders && (tags.motorcar == 'no' || (tags['motor_vehicle'] == 'no' && tags.bicycle == 'yes'))) {
            return i18n('No motor vehicles');
        }
        return riders ? i18n('Shared-use path') : i18n('Footway');
    }

    /*
        Slots across the street, ordered left to right. Widths are proportional,
        not metric - OSM rarely knows the real ones, and a schematic that pretends
        to be measured is worse than one that does not.
    */
    function buildSlots(path) {
        var tags = path.tags || path.info || {};
        var sides = path.sides || [];
        var highway = tags.highway;
        var slots = [];

        var centre = sideByName(sides, 'centre');
        var left = sideByName(sides, 'left');
        var right = sideByName(sides, 'right');

        /*
            A crossing carries traffic over the carriageway rather than along it, so it
            gets a slot of its own and the dashed edges that mark it on the ground.
        */
        if (isCrossing(tags)) {
            var users = crossingUsers(tags);
            slots.push({
                kind: 'crossing',
                w: 3.2,
                dir: channel(centre, 'direction') || 'two_way',
                bike: users.rides,
                walk: users.walks,
                label: crossingLabel(tags)
            });
            return slots;
        }

        /*
            A tram body is not a carriageway. Every railway=tram way in the extract is
            tagged without a highway at all, and motor traffic is excluded from it, so
            laying out traffic lanes here would draw a road that is not there.
        */
        if (tags.railway == 'tram' && (highway == undefined || tags.motor_vehicle == 'no')) {
            var tram_bicycle = tags.bicycle == 'yes' || tags.bicycle == 'designated';
            slots.push({
                kind: 'tramway',
                w: 3.2,
                dir: tags.oneway == 'yes' ? 'forward' : 'two_way',
                bike: tram_bicycle,
                transit: i18n('TRAM'),
                label: tram_bicycle ? i18n('Tram & bicycle access') : i18n('Tram line')
            });
            return slots;
        }

        /*
            A way that is itself the infrastructure has no carriageway to lay out. What
            it does have is a question of who may use it, and only the tags may answer:

              segregated=yes   a combined path with the two users kept apart
              foot allowed     a combined path they share
              otherwise        a cycle path, and pedestrians are not on it

            Most cycleways in the extract are the third case - no foot tag, no
            segregated tag - and reading them as shared invents pedestrians.
        */
        if (highway == 'cycleway') {
            /*
                segregated=yes is the one case where a cycleway carries a footway of its
                own, drawn beside it and divided by a line. Everywhere else it is a cycle
                path; foot=yes there is tolerated access, not a shared surface.
            */
            if (tags.segregated == 'yes') {
                slots.push({kind: 'footway', w: 1.5, label: i18n('Footway')});
                slots.push({kind: 'cycle', w: 2.0, dir: channel(centre, 'direction'), sep: 'divider', label: pathLabel(tags)});
            } else {
                slots.push({kind: 'cycle', w: 3.0, dir: channel(centre, 'direction'), sep: 'none', label: pathLabel(tags)});
            }
            return slots;
        }
        if (highway == 'pedestrian' || highway == 'footway' || highway == 'path') {
            var allows_bicycle = tags.bicycle == 'yes' || tags.bicycle == 'designated';
            /*
                segregated=yes says the two users are kept apart on the same way, so it
                is drawn as two strips divided by a line rather than as one shared strip.
                Which side each is on is not tagged; the footway is drawn on the left.
            */
            if (allows_bicycle && tags.segregated == 'yes' && highway != 'pedestrian') {
                slots.push({kind: 'footway', w: 1.7, label: i18n('Footway')});
                slots.push({kind: 'cycle', w: 2.0, dir: 'two_way', sep: 'divider', label: i18n('Segregated bike lane')});
                return slots;
            }
            slots.push({
                kind: 'pedestrian',
                w: 4.0,
                dir: 'two_way',
                bike: allows_bicycle,
                zone: highway == 'pedestrian',
                label: pathLabel(tags)
            });
            return slots;
        }

        // sidewalks are drawn where tagged and hatched where nothing is known - an
        // untagged side is not the same as a side that was surveyed and has nothing
        var footway_left = footwaySlot(tags, 'left');
        var footway_right = footwaySlot(tags, 'right');

        if (footway_left) {
            slots.push(footway_left);
        }
        slots = slots.concat(kerbside(tags, left, 'left'));

        var motor = motorLanes(tags);
        applyShared(motor, left, 'left');
        applyShared(motor, right, 'right');
        slots = slots.concat(motor);

        slots = slots.concat(kerbside(tags, right, 'right').reverse());
        if (footway_right) {
            slots.push(footway_right);
        }
        return slots;
    }

    /*
        Everything between the footway and the carriageway on one side, ordered from the
        kerb inward.

        Which of the cycle lane and the parking is nearer the kerb is not a convention -
        the parking tag says it. parking:<side>=lane means the parked cars occupy a lane
        of the carriageway, so they sit between the moving traffic and the cycle lane.
        Every other value - separate, street_side, on_kerb - puts them outside the
        carriageway, and the cycle lane runs between them and the traffic.
    */
    function kerbside(tags, side, name) {
        var slots = [];
        var cycle = (side && !channel(side, 'shared')) ? cycleSlot(side, name) : null;
        var parking = parkingSlot(tags, name);

        if (parking && !parking.in_carriageway) {
            slots.push(parking);
            parking = null;
        }
        if (cycle) {
            slots.push(cycle);
        }
        if (parking) {
            slots.push(parking);
        }
        return slots;
    }

    /*
        Two tagging schemes are in use and both appear in the extract: the current
        parking:<side>, and the older parking:lane:<side> whose value is the orientation
        itself. Orientation decides the width, because a perpendicular bay is half again
        as deep as a parallel one.
    */
    function parkingSlot(tags, name) {
        var value = tags['parking:' + name];
        if (value == undefined) {
            value = tags['parking:both'];
        }
        var legacy = tags['parking:lane:' + name];
        if (legacy == undefined) {
            legacy = tags['parking:lane:both'];
        }
        if (value == undefined) {
            value = legacy;
        }
        if (value == undefined) {
            return null;
        }
        // only these say there is no parking on this side
        var empty = {no: 1, none: 1, no_parking: 1, no_stopping: 1, fire_lane: 1};
        if (empty[value]) {
            return null;
        }
        /*
            parking:<side>=separate means the parking is there but drawn as its own way
            or area elsewhere in OSM - the orientation is usually tagged alongside it,
            which is how we know. It still occupies the kerbside, so it is still drawn.
        */
        var mapped_elsewhere = value == 'separate';
        var orientation = tags['parking:' + name + ':orientation'];
        if (orientation == undefined) {
            orientation = tags['parking:both:orientation'];
        }
        if (orientation == undefined && (legacy == 'parallel' || legacy == 'diagonal' || legacy == 'perpendicular')) {
            orientation = legacy;
        }
        if (orientation == undefined) {
            // the legacy scheme also nests the orientation as its own key
            ['parallel', 'diagonal', 'perpendicular'].forEach(function(candidate) {
                if (tags['parking:lane:' + name + ':' + candidate] != undefined) {
                    orientation = candidate;
                }
            });
        }
        var widths = {parallel: 2.0, diagonal: 2.6, perpendicular: 3.2};
        return {
            kind: 'parking',
            w: widths[orientation] || 2.0,
            orientation: orientation || 'parallel',
            separate: mapped_elsewhere,
            // parked in a lane of the road, rather than in a bay outside it
            in_carriageway: value == 'lane',
            label: i18n('Parking')
        };
    }

    /*
        sidewalk:<side> beats sidewalk:both beats sidewalk. A side that is explicitly
        no gets no slot at all; a side nobody has surveyed gets a hatched one, so that
        silence in the tags never reads as an absence on the ground.
    */
    function footwaySlot(tags, side) {
        var value = tags['sidewalk:' + side];
        if (value == undefined) {
            value = tags['sidewalk:both'];
        }
        if (value == undefined) {
            value = tags.sidewalk;
        }
        if (value == undefined) {
            /*
                foot=use_sidepath says a parallel path exists somewhere, not that there
                is one on each side, and not that it is a footway rather than a tram
                reservation or a service road. Reading two sidewalks out of it invents
                them, so an untagged side stays unknown.
            */
            return {kind: 'unknown', w: 1.3};
        }
        if (value == 'no' || value == 'none') {
            return null;
        }
        if (value == 'left' || value == 'right') {
            return value == side ? {kind: 'footway', w: 1.3, label: i18n('Footway')} : null;
        }
        return {kind: 'footway', w: 1.3, label: i18n('Footway')};
    }

    function cycleSlot(side, name) {
        var lane = channel(side, 'lane');
        return {
            kind: 'cycle',
            side: name,
            w: 1.6,
            form: channel(side, 'form'),
            dir: channel(side, 'direction'),
            sep: channel(side, 'separation'),
            lane: lane,
            label: lane == 'advisory' ? i18n('Advisory') : formLabel(channel(side, 'form'))
        };
    }

    function motorLanes(tags) {
        var oneway = tags.oneway == 'yes';
        var total = parseInt(tags.lanes, 10);
        if (isNaN(total)) {
            total = oneway ? 1 : 2;
        }
        var forward = parseInt(tags['lanes:forward'], 10);
        var backward = parseInt(tags['lanes:backward'], 10);
        if (oneway) {
            forward = total;
            backward = 0;
        } else if (isNaN(forward) || isNaN(backward)) {
            forward = Math.ceil(total / 2);
            backward = total - forward;
        }
        var lanes = [];
        // right-hand traffic: the backward lanes sit on the left of the drawing
        for (var i = 0; i < backward; i++) {
            lanes.push({kind: 'motor', w: 2.7, dir: 'backward'});
        }
        for (var j = 0; j < forward; j++) {
            lanes.push({kind: 'motor', w: 2.7, dir: 'forward'});
        }
        if (!lanes.length) {
            lanes.push({kind: 'motor', w: 2.7, dir: oneway ? 'forward' : 'two_way'});
        }
        return lanes;
    }

    /*
        shared_lane and share_busway are not their own strip of road - they mark
        the outermost carriageway lane on their side. Drawing them as a separate
        parallel line has always been the wrong picture.
    */
    function applyShared(lanes, side, name) {
        if (!side || !channel(side, 'shared')) {
            return;
        }
        var lane = name == 'left' ? lanes[0] : lanes[lanes.length - 1];
        if (!lane) {
            return;
        }
        lane.bike = true;
        lane.bike_dir = channel(side, 'direction');
        var transit = channel(side, 'transit');
        if (transit) {
            lane.kind = 'busway';
            lane.w = 3.2;
            lane.transit = transit == 'tram' ? i18n('TRAM') : i18n('BUS');
            lane.label = i18n('Bus & bike lane');
        } else {
            // cycleway=shared_lane grants no facility of its own - the rider is in the
            // traffic lane, so the drawing says road rather than inventing a lane type
            lane.label = i18n('Road');
        }
    }

    function sideByName(sides, name) {
        for (var i = 0; i < sides.length; i++) {
            if (sides[i].side == name) {
                return sides[i];
            }
        }
        return null;
    }

    function channel(side, name) {
        if (!side || !side.channels) {
            return undefined;
        }
        return side.channels[name];
    }

    /*
        The same words the sidebar already uses for these tags, so the drawing and the
        description below it never call the same thing two different names.
    */
    function formLabel(form) {
        var labels = {
            lane: i18n('Bike lane'),
            track: i18n('Segregated bike lane'),
            shared_lane: i18n('Road'),
            share_busway: i18n('Bus & bike lane'),
            shoulder: i18n('Shoulder'),
            asl: i18n('Advanced stop line'),
            crossing: i18n('Crossing'),
            sidepath: i18n('Parallel path'),
            tolerated: i18n('Cycling allowed')
        };
        return labels[form] || form;
    }

    /*
        Rendering. Two-way slots get two separate arrows sitting on the same row,
        each centred in its own half of the slot, rather than one double-headed
        arrow - the slot really does carry two streams side by side.
    */
    function arrows(cx, y, w, dir, colour, faint) {
        var opacity = '';
        if (faint) {
            colour = 'var(--xs-label)';
        }
        var glyph = {forward: '↑', backward: '↓'};
        if (dir != 'two_way') {
            if (!glyph[dir]) {
                return '';
            }
            return '<text x="' + cx.toFixed(1) + '" y="' + y + '" font-size="15" text-anchor="middle" fill="' + colour + '"' + opacity + '>' + glyph[dir] + '</text>';
        }
        var offset = w / 4;
        return '<text x="' + (cx - offset).toFixed(1) + '" y="' + y + '" font-size="14" text-anchor="middle" fill="' + colour + '"' + opacity + '>↓</text>'
            + '<text x="' + (cx + offset).toFixed(1) + '" y="' + y + '" font-size="14" text-anchor="middle" fill="' + colour + '"' + opacity + '>↑</text>';
    }

    function bikeGlyph(cx, cy, colour, scale) {
        var k = scale || 1;
        var r = 3.6 * k;
        var dx = 5.5 * k;
        var dy = 2 * k;
        var sy = 3.5 * k;
        return '<g stroke="' + colour + '" stroke-width="' + (1.3 * k).toFixed(2) + '" fill="none" stroke-linecap="round">'
            + '<circle cx="' + (cx - dx).toFixed(1) + '" cy="' + (cy + dy).toFixed(1) + '" r="' + r.toFixed(1) + '"/>'
            + '<circle cx="' + (cx + dx).toFixed(1) + '" cy="' + (cy + dy).toFixed(1) + '" r="' + r.toFixed(1) + '"/>'
            + '<path d="M' + (cx - dx).toFixed(1) + ' ' + (cy + dy).toFixed(1)
                + ' L' + (cx - 0.5 * k).toFixed(1) + ' ' + (cy + dy).toFixed(1)
                + ' L' + (cx + 1.5 * k).toFixed(1) + ' ' + (cy - sy).toFixed(1)
                + ' L' + (cx + dx).toFixed(1) + ' ' + (cy + dy).toFixed(1) + '"/>'
            + '<path d="M' + (cx - 2.5 * k).toFixed(1) + ' ' + (cy - sy).toFixed(1) + ' h' + (3.5 * k).toFixed(1) + '"/>'
            + '</g>';
    }

    /* One bay, with the P inside it. */
    function parkingMark(x, y, w, h) {
        var inset = 6;
        var box_x = x + inset;
        var box_y = y + inset;
        var box_w = Math.max(10, w - inset * 2);
        var box_h = Math.max(20, h - inset * 2);
        return '<rect x="' + box_x.toFixed(1) + '" y="' + box_y.toFixed(1)
            + '" width="' + box_w.toFixed(1) + '" height="' + box_h.toFixed(1)
            + '" rx="3" fill="none" stroke="var(--xs-parking-car)" stroke-width="1.6"/>'
            + '<text x="' + (box_x + box_w / 2).toFixed(1) + '" y="' + (box_y + box_h / 2 + 11).toFixed(1)
            + '" font-size="30" font-weight="700" text-anchor="middle" fill="var(--xs-label)">P</text>';
    }

    /*
        Pedestrians are always the adult-and-child pair from the sign - a footway, a
        shared-use path and a pedestrian zone all draw the same figures, only smaller
        where the slot is narrower.
    */
    function pedestrianGlyph(cx, cy, colour, scale) {
        return pedestrianZoneGlyph(cx, cy, colour, (scale || 1) * 0.52);
    }

    /*
        The figures from the Slovak "pesia zona" sign - an adult walking with a child.
        A pedestrian zone is somewhere people walk together rather than a footway you
        pass along, and the pair says that where a single walking figure does not.

        Drawn in a local 40x56 box and scaled from the centre.
    */
    function pedestrianZoneGlyph(cx, cy, colour, scale) {
        var k = scale || 1;
        var offset_x = cx - 20 * k;
        var offset_y = cy - 28 * k;
        return '<g transform="translate(' + offset_x.toFixed(1) + ' ' + offset_y.toFixed(1) + ') scale(' + k.toFixed(3) + ')" fill="' + colour + '">'
            + '<circle cx="14" cy="9" r="5.6"/>'
            + '<path d="M14 16 C 9.2 16 7.2 18.6 6.6 22 L 4 32.6 L 6.9 33.6 L 9.2 25.2 L 6 41 L 22 41 L 18.8 25.2 L 21.1 33.6 L 24 32.6 L 21.4 22 C 20.8 18.6 18.8 16 14 16 Z"/>'
            + '<rect x="10.2" y="41" width="3.4" height="13.4" rx="1.2"/>'
            + '<rect x="14.9" y="41" width="3.4" height="13.4" rx="1.2"/>'
            + '<path d="M23.2 33.4 L27.4 37.4 L26 39.2 L21.8 35.2 Z"/>'
            + '<circle cx="31.4" cy="24.2" r="4.1"/>'
            + '<path d="M31.4 29 C 28.6 29 27.4 30.8 27 33 L 25.4 39.4 L 27.8 40.2 L 29.2 35.6 L 27.6 47 L 35.2 47 L 33.6 35.6 L 35 40.2 L 37.4 39.4 L 35.8 33 C 35.4 30.8 34.2 29 31.4 29 Z"/>'
            + '<rect x="28.4" y="47" width="2.9" height="7.4" rx="1"/>'
            + '<rect x="31.9" y="47" width="2.9" height="7.4" rx="1"/>'
            + '</g>';
    }

    /*
        A rail seen end on: head, web and foot. Rails embedded in a surface are a real
        hazard on a bike - a wheel dropped into the flangeway goes down - so they are
        drawn on whatever surface carries them rather than left to the tag list.
    */
    function railPair(centre_x, gauge, y, h, colour) {
        var left = centre_x - gauge / 2;
        var right = centre_x + gauge / 2;
        var parts = '';
        // sleepers first, so the rails read as track rather than as two stray lines
        for (var ty = y + 9; ty < y + h - 4; ty = ty + 15) {
            parts = parts + '<line x1="' + (left - 4).toFixed(1) + '" y1="' + ty.toFixed(1)
                + '" x2="' + (right + 4).toFixed(1) + '" y2="' + ty.toFixed(1)
                + '" stroke="' + colour + '" stroke-width="2.4" stroke-opacity="0.35"/>';
        }
        parts = parts + '<line x1="' + left.toFixed(1) + '" y1="' + y + '" x2="' + left.toFixed(1) + '" y2="' + (y + h) + '" stroke="' + colour + '" stroke-width="2.6"/>';
        parts = parts + '<line x1="' + right.toFixed(1) + '" y1="' + y + '" x2="' + right.toFixed(1) + '" y2="' + (y + h) + '" stroke="' + colour + '" stroke-width="2.6"/>';
        return parts;
    }

    /* embedded_rails names the surface they are laid into; railway=tram on a highway
       way means the same thing said the other way round */
    function embeddedRails(tags) {
        var rails = tags['embedded_rails'];
        if (rails == undefined && tags.railway == 'tram') {
            rails = 'tram';
        }
        if (rails == undefined || rails == 'no') {
            return null;
        }
        return rails;
    }

    function transitMark(cx, cy, text, colour) {
        return '<text x="' + cx.toFixed(1) + '" y="' + cy + '" font-size="11" font-weight="600" letter-spacing="0.08em" text-anchor="middle" fill="' + colour + '">' + escapeText(text) + '</text>';
    }

    function escapeText(value) {
        return String(value).replace(/[&<>"]/g, function(character) {
            return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[character];
        });
    }

    function render(path) {
        var tags = path.tags || path.info || {};
        var slots = buildSlots(path);
        if (!slots.length) {
            return '';
        }
        var width = 460;
        var height = 200;
        var pad = 14;
        var top = 44;
        var body = 92;
        var total = 0;
        for (var s = 0; s < slots.length; s++) {
            total = total + slots[s].w;
        }
        var scale = (width - pad * 2) / (total || 1);
        var parts = [];

        /*
            Rails are embedded in a surface rather than occupying one of their own, so
            their span is worked out first and they are drawn under the slot pass. That
            way the glyphs on a surface sit on top of its track instead of behind it.
        */
        var rails = embeddedRails(tags);
        var rail_bed = null;
        var measure_x = pad;
        slots.forEach(function(slot) {
            var slot_w = slot.w * scale;
            if (slot.kind == 'motor' || slot.kind == 'busway' || slot.kind == 'pedestrian' || slot.kind == 'tramway') {
                if (rail_bed == null) {
                    rail_bed = {from: measure_x, to: measure_x + slot_w};
                } else {
                    rail_bed.to = measure_x + slot_w;
                }
            }
            measure_x = measure_x + slot_w;
        });
        var x = pad;

        parts.push('<defs>'
            + '<pattern id="xs-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
            + '<rect width="6" height="6" fill="currentColor" opacity="0.07"/>'
            + '<line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-opacity="0.22" stroke-width="1.6"/>'
            + '</pattern>'
            + '</defs>');
        parts.push('<rect x="0" y="' + (top + body) + '" width="' + width + '" height="10" fill="currentColor" opacity="0.1"/>');

        /*
            Three layers, in this order: the surfaces, then the track laid into them,
            then everything drawn on top. Rails painted before the surfaces were simply
            covered by them; painted after the glyphs they would cover those instead.
        */
        var slabs = [];
        var marks = [];
        var rail_centre = rail_bed ? (rail_bed.from + rail_bed.to) / 2 : 0;
        var gauge = rail_bed ? Math.min(40, Math.max(20, (rail_bed.to - rail_bed.from) * 0.3)) : 0;

        slots.forEach(function(slot) {
            var w = slot.w * scale;
            var cx = x + w / 2;
            /*
                Where a track runs through this surface the glyphs move out beyond the
                rails rather than sitting on them: a pair straddles the track, a lone
                glyph steps to the side of it.
            */
            var rail_shift = 0;
            if (rails && rail_bed && x < rail_bed.to && (x + w) > rail_bed.from) {
                rail_shift = gauge / 2 + 14;
            }
            var place = function(delta) {
                if (!rail_shift) {
                    return cx + delta;
                }
                if (delta == 0) {
                    return cx - rail_shift;
                }
                return cx + (delta > 0 ? rail_shift : -rail_shift);
            };
            var is_cycle = slot.kind == 'cycle';
            var is_unknown = slot.kind == 'unknown';
            var is_crossing = slot.kind == 'crossing';
            var raised = slot.kind == 'footway' || is_unknown;
            var y = raised ? top - 6 : top;
            var h = raised ? body + 6 : body;
            var opacity = 1;
            if (is_cycle) {
                opacity = 0.2;
            } else if (slot.kind == 'busway') {
                opacity = 0.18;
            } else if (slot.kind == 'footway' || slot.kind == 'pedestrian') {
                opacity = 0.38;
            } else if (slot.kind == 'parking') {
                opacity = 0.5;
            }

            slabs.push('<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + h + '" fill="' + (FILL[slot.kind] || FILL.motor) + '" opacity="' + opacity + '"/>');

            /*
                A crossing is marked on the road by the lines along its two edges, so
                that is how it is drawn here: dashed sides, and the users named inside.
            */
            if (slot.kind == 'crossing') {
                marks.push('<line x1="' + x.toFixed(1) + '" y1="' + y + '" x2="' + x.toFixed(1) + '" y2="' + (y + h) + '" stroke="var(--xs-label)" stroke-width="2" stroke-dasharray="8 6"/>');
                marks.push('<line x1="' + (x + w).toFixed(1) + '" y1="' + y + '" x2="' + (x + w).toFixed(1) + '" y2="' + (y + h) + '" stroke="var(--xs-label)" stroke-width="2" stroke-dasharray="8 6"/>');
                if (slot.walk && slot.bike) {
                    marks.push(pedestrianGlyph(place(-15), top + 60, 'var(--xs-foot-glyph)', 1.3));
                    marks.push(bikeGlyph(place(15), top + 60, 'var(--xs-cycle)', 1.2));
                } else if (slot.bike) {
                    marks.push(bikeGlyph(place(0), top + 60, 'var(--xs-cycle)', 1.3));
                } else {
                    marks.push(pedestrianGlyph(place(0), top + 58, 'var(--xs-foot-glyph)', 1.5));
                }
            }

            if (slot.kind == 'parking') {
                if (slot.separate) {
                    marks.push('<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="' + h + '" fill="none" stroke="var(--xs-parking-car)" stroke-width="1" stroke-dasharray="4 4"/>');
                }
                marks.push(parkingMark(x, y, w, h));
            }

            /*
                A kerb-separated track gets a cap. A painted lane gets its two edge lines
                drawn the way they are painted on the road: solid for a mandatory lane,
                broken for an advisory one, which is the difference between them.
            */
            if (is_cycle && slot.sep == 'divider') {
                // the painted line that keeps the two users apart on a segregated path
                marks.push('<line x1="' + x.toFixed(1) + '" y1="' + y + '" x2="' + x.toFixed(1) + '" y2="' + (y + h) + '" stroke="var(--xs-cycle)" stroke-width="2.4"/>');
            } else if (is_cycle && slot.sep == 'kerb') {
                marks.push('<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + w.toFixed(1) + '" height="5" fill="var(--xs-cycle)"/>');
            } else if (is_cycle && (slot.sep == 'paint' || slot.sep == 'buffer')) {
                var dash = slot.lane == 'advisory' ? ' stroke-dasharray="7 5"' : '';
                marks.push('<line x1="' + x.toFixed(1) + '" y1="' + y + '" x2="' + x.toFixed(1) + '" y2="' + (y + h) + '" stroke="var(--xs-cycle)" stroke-width="2"' + dash + '/>');
                marks.push('<line x1="' + (x + w).toFixed(1) + '" y1="' + y + '" x2="' + (x + w).toFixed(1) + '" y2="' + (y + h) + '" stroke="var(--xs-cycle)" stroke-width="2"' + dash + '/>');
            }

            var dir = is_cycle ? slot.dir : (slot.bike ? slot.bike_dir : slot.dir);
            if (dir && slot.kind != 'footway' && slot.kind != 'parking' && slot.kind != 'pedestrian' && !is_unknown) {
                var highlight = is_cycle || slot.bike;
                var colour = highlight ? (slot.kind == 'busway' ? 'var(--xs-transit-text)' : 'var(--xs-cycle-text)') : 'var(--xs-label)';
                marks.push(arrows(cx, top + 30, w, dir, colour, !highlight));
            }

            // a lane shared with motor traffic: BUS/TRAM on its own row above the bicycle
            if (slot.kind == 'footway' && w > 16 && !is_crossing) {
                marks.push(pedestrianGlyph(place(0), top + 46, 'var(--xs-foot-glyph)', 1.15));
            }
            /*
                A pedestrian zone belongs to people on foot; cycling is tolerated in it.
                Both facts are drawn, the walker first.
            */
            if (slot.kind == 'pedestrian') {
                if (slot.zone && slot.bike) {
                    // a zone people may also ride through names both users
                    marks.push(pedestrianZoneGlyph(place(-19), top + 44, 'var(--xs-foot-glyph)', 0.72));
                    marks.push(bikeGlyph(place(19), top + 50, 'var(--xs-cycle)', 1.3));
                } else if (slot.zone) {
                    marks.push(pedestrianZoneGlyph(place(0), top + 44, 'var(--xs-foot-glyph)', 0.72));
                } else if (slot.bike) {
                    marks.push(pedestrianGlyph(place(-16), top + 58, 'var(--xs-foot-glyph)', 1.4));
                    marks.push(bikeGlyph(place(16), top + 58, 'var(--xs-cycle)', 1.25));
                } else {
                    marks.push(pedestrianGlyph(place(0), top + 56, 'var(--xs-foot-glyph)', 1.5));
                }
            }
            // a cycle slot names its user, the same way a transit lane does
            if (is_cycle && !slot.foot && w > 16) {
                marks.push(bikeGlyph(place(0), top + 62, 'var(--xs-cycle)', 1.15));
            }
            // a path nobody has divided: walkers and riders on the same surface
            if (is_cycle && slot.foot) {
                marks.push(pedestrianGlyph(place(-16), top + 60, 'var(--xs-foot-glyph)', 1.3));
                marks.push(bikeGlyph(place(16), top + 60, 'var(--xs-cycle)', 1.2));
            }
            /*
                A transit lane needs both users named, because sharing with a bus is the
                whole point of the tag. A plain shared lane is just the carriageway with
                a marking on it - its arrow and its label already say so, and a bicycle
                glyph there only competes with the cycle slots that mean something else.
            */
            if (slot.transit && !is_crossing) {
                marks.push(transitMark(cx, top + 56, slot.transit, 'var(--xs-transit-text)'));
                marks.push(bikeGlyph(cx, top + 76, 'var(--xs-transit)', 1.15));
            }

            if (w > 26) {
                var label = slot.label || (slot.kind == 'motor' ? i18n('Road') : '');
                if (label) {
                    marks.push('<text x="' + cx.toFixed(1) + '" y="' + (top + body + 26) + '" font-size="10" text-anchor="middle" fill="var(--xs-label)">' + escapeText(label) + '</text>');
                }
            }
            x = x + w;
        });

        parts = parts.concat(slabs);
        if (rails && rail_bed) {
            parts.push(railPair(rail_centre, gauge, top, body, 'var(--xs-rail)'));
        }
        parts = parts.concat(marks);

        // the rail note goes on the free centre of the caption row, clear of every glyph
        if (rails && rail_bed) {
            parts.push('<text x="' + (width / 2).toFixed(1) + '" y="26" font-size="10" text-anchor="middle" fill="var(--xs-rail)">'
                + escapeText(rails == 'tram' ? i18n('Tram rails') : i18n('Embedded rails')) + '</text>');
        }

        parts.push('<text x="' + pad + '" y="26" font-size="10" fill="var(--xs-label)">◀ ' + escapeText(i18n('Left side')) + '</text>');
        parts.push('<text x="' + (width - pad) + '" y="26" font-size="10" text-anchor="end" fill="var(--xs-label)">' + escapeText(i18n('Right side')) + ' ▶</text>');

        return '<svg class="crosssection" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeText(i18n('Street cross-section')) + '">' + parts.join('') + '</svg>';
    }

    /*
        Most ways in the layer carry no name at all - cycleways, footways and service
        roads rarely have one - so the heading falls back to what the way actually is.

        For a way that is itself the infrastructure, that answer is the one its own slot
        already gives, so the heading and the label under the drawing cannot disagree.
    */
    function title(path) {
        var tags = path.tags || path.info || {};
        if (tags.name) {
            return tags.name;
        }
        if (isCrossing(tags)) {
            return crossingLabel(tags);
        }
        var standalone = {cycleway: 1, pedestrian: 1, footway: 1, path: 1};
        if (standalone[tags.highway] || tags.railway == 'tram') {
            return pathLabel(tags);
        }
        if (tags.ref) {
            return i18n('Route') + ' ' + tags.ref;
        }
        var by_highway = {
            service: i18n('Service road'),
            track: i18n('Track'),
            steps: i18n('Steps')
        };
        if (by_highway[tags.highway]) {
            return by_highway[tags.highway];
        }
        return i18n('Unnamed street');
    }

    return {
        build: buildSlots,
        render: render,
        title: title,
        isCrossing: isCrossing,
        crossingLabel: crossingLabel
    };
})();
