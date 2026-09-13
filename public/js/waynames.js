/*
    What a way is called, from its OSM tags. Shared by the map's sidebar (main.js), the street
    cross-section (crosssection.js) and the turn by turn navigation (navigation.js), so the three
    never call the same way two different names.

    kind() answers with an abstract key, label() turns a key into the words of the page's
    language through the translation files. No Leaflet, no DOM - it runs in node for tests too.
*/

var wayNames = (function() {

    var LABELS = {
        crossing_both: 'Pedestrian and cycle crossing',
        crossing_cycle: 'Cycle crossing',
        crossing_foot: 'Pedestrian crossing',
        pedestrian_zone: 'Pedestrian zone',
        tram_bicycle: 'Tram & bicycle access',
        tram: 'Tram line',
        cycleway: 'Segregated bike lane',
        no_motor: 'No motor vehicles',
        shared_use: 'Shared-use path',
        footway: 'Footway',
        steps: 'Steps',
        advisory: 'Advisory',
        sharrows: 'Sharrows',
        bus_bike: 'Bus & bike lane',
        bike_lane: 'Bike lane',
        bike_track: 'Bike track',
        contraflow: 'Contraflow',
        crossing_marking: 'Crossing',
        service: 'Service road',
        track: 'Track',
        road: 'Road'
    };

    // the way as a whole is the infrastructure, rather than a street with something marked on it
    var WHOLE_WAY = ['crossing_both', 'crossing_cycle', 'crossing_foot', 'pedestrian_zone', 'tram_bicycle', 'tram', 'cycleway', 'no_motor', 'shared_use', 'footway', 'steps'];

    // the cycling tags of a street, in the order the sidebar lists them
    var MARKING_TAGS = ['cycleway:lane', 'cycleway', 'cycleway:right:lane', 'cycleway:right', 'cycleway:left:lane', 'cycleway:left', 'cycleway:both:lane', 'cycleway:both'];

    function translate(text) {
        return typeof i18n == 'function' ? i18n(text) : text;
    }

    /*
        A crossing is tagged on the way that carries it rather than as a value of its
        own, and in several places at once - footway=crossing, cycleway=crossing, or
        path=crossing - so all of them are checked.
    */
    function isCrossing(tags) {
        return tags.highway == 'crossing'
            || tags.footway == 'crossing'
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

    function crossingKind(tags) {
        var users = crossingUsers(tags);
        if (users.rides && users.walks) {
            return 'crossing_both';
        }
        return users.rides ? 'crossing_cycle' : 'crossing_foot';
    }

    /* what a cycling tag value on a street is, advisory, sharrows, lane, ...; null for none */
    function markingKind(value) {
        if (value == undefined || !value) {
            return null;
        }
        value = String(value);
        if (value.indexOf('advisory') != -1) {
            return 'advisory';
        } else if (value.indexOf('shared_lane') != -1) {
            return 'sharrows';
        } else if (value.indexOf('share_busway') != -1) {
            return 'bus_bike';
        } else if (value.indexOf('lane') != -1) {
            return 'bike_lane';
        } else if (value.indexOf('track') != -1) {
            return 'bike_track';
        } else if (value.indexOf('opposite') != -1) {
            return 'contraflow';
        } else if (value.indexOf('crossing') != -1) {
            return 'crossing_marking';
        }
        return null;
    }

    /*
        What a way is. Crossings first, as they are tagged on ways of every other kind; a pedestrian
        zone stays one even with trams running through it. A street is named by what is marked on it
        for cycling - from its tags, or from the channels resolved per side (path.sides) - and
        otherwise by the kind of road it is.
        @return one of the keys of LABELS
    */
    function kind(tags, sides) {
        tags = tags || {};
        if (isCrossing(tags)) {
            return crossingKind(tags);
        }
        if (tags.highway == 'pedestrian') {
            return 'pedestrian_zone';
        }
        if (tags.railway == 'tram') {
            return (tags.bicycle == 'yes' || tags.bicycle == 'designated') ? 'tram_bicycle' : 'tram';
        }
        if (tags.highway == 'cycleway') {
            return 'cycleway';
        }
        if (tags.highway == 'steps') {
            return 'steps';
        }
        if (tags.highway == 'footway' || tags.highway == 'path' || tags.highway == 'bridleway') {
            var riders = tags.bicycle == 'yes' || tags.bicycle == 'designated';
            if (riders && (tags.motorcar == 'no' || (tags.motor_vehicle == 'no' && tags.bicycle == 'yes'))) {
                return 'no_motor';
            }
            return riders ? 'shared_use' : 'footway';
        }
        for (var i = 0; i < MARKING_TAGS.length; i++) {
            var value = tags[MARKING_TAGS[i]];
            var marking = value == 'separate' ? null : markingKind(value);
            if (marking != null) {
                return marking;
            }
        }
        var channels = (sides || []).map(function(side) {
            return side && side.channels ? side.channels : {};
        });
        for (var j = 0; j < channels.length; j++) {
            if (channels[j].lane == 'advisory') {
                return 'advisory';
            }
            var form = markingKind(channels[j].form);
            if (form != null && form != 'crossing_marking') {
                return form;
            }
        }
        if (tags.highway == 'service') {
            return 'service';
        }
        if (tags.highway == 'track') {
            return 'track';
        }
        return 'road';
    }

    function label(key) {
        return LABELS[key] != undefined ? translate(LABELS[key]) : '';
    }

    function crossingLabel(tags) {
        return label(crossingKind(tags));
    }

    /* the words for a cycling tag value, as the sidebar lists them; empty for none */
    function markingLabel(value) {
        return label(markingKind(value));
    }

    /* the words for a resolved channel form, as the cross-section labels its strips */
    function formLabel(form) {
        var labels = {
            lane: 'Bike lane',
            track: 'Segregated bike lane',
            shared_lane: 'Road',
            share_busway: 'Bus & bike lane',
            shoulder: 'Shoulder',
            asl: 'Advanced stop line',
            crossing: 'Crossing',
            sidepath: 'Parallel path',
            tolerated: 'Cycling allowed'
        };
        return labels[form] != undefined ? translate(labels[form]) : form;
    }

    function isWholeWay(key) {
        return WHOLE_WAY.indexOf(key) != -1;
    }

    return {
        kind: kind,
        label: label,
        isWholeWay: isWholeWay,
        isCrossing: isCrossing,
        crossingUsers: crossingUsers,
        crossingLabel: crossingLabel,
        markingLabel: markingLabel,
        formLabel: formLabel
    };
})();

if (typeof module != 'undefined' && module.exports) {
    module.exports = wayNames;
}
