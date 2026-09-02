<?php

namespace App\Services;

/**
 * Resolves OSM cycleway tagging into per-side features.
 *
 * One way becomes one centre feature plus, where the tags describe them, a left
 * and/or right feature. Each carries three independent channels:
 *
 *   form        what the infrastructure is  (track, lane, shared, ...)
 *   direction   which way it may be ridden, relative to the way's direction
 *   separation  how it is separated from motor traffic
 *
 * Keeping the resolution here means the browser never has to reimplement OSM's
 * tag precedence rules, and the cross-section drawing and the map rendering
 * always agree.
 */
class CyclewayNormalizer
{
    /** Screen pixels a side feature is offset from the centreline. */
    public const OFFSET = 5;

    /** Values of cycleway=* that mean some form of cycling infrastructure. */
    private const FORMS = [
        'lane', 'track', 'opposite_lane', 'opposite_track', 'opposite',
        'shared_lane', 'share_busway', 'shared_busway', 'shoulder', 'sidepath',
        'asl', 'crossing', 'yes',
    ];

    /** Forms that live in the carriageway rather than beside it. */
    private const SHARED_FORMS = ['shared_lane', 'share_busway', 'shared_busway'];

    /** Tag prefixes consumed into side features, so the centre does not restyle on them. */
    private const CONSUMED = ['cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both'];

    /**
     * @param  array<string, string>  $tags
     * @return list<array{side: string, offset: int, channels: array<string, mixed>}>
     */
    public function sides(array $tags): array
    {
        $highway = $tags['highway'] ?? '';

        // A standalone path already has its own geometry — nothing to offset.
        if ($highway == 'cycleway' or $highway == 'pedestrian' or $highway == 'footway' or $highway == 'path') {
            $channels = $this->standaloneChannels($tags);
            if ($channels['form'] == 'none') {
                return [];
            }

            return [[
                'side' => 'centre',
                'offset' => 0,
                'channels' => $channels,
            ]];
        }

        $sides = [];
        foreach (['left' => -self::OFFSET, 'right' => self::OFFSET] as $side => $offset) {
            $form = $this->form($tags, $side);
            if (! $this->isInfrastructure($form)) {
                continue;
            }
            /*
                A shared lane is still on one side of the street - a bus lane is the
                outermost lane, not the middle of the road - so it is offset like any
                other side feature. Drawing it on the centreline put it on the wrong
                part of the carriageway.
            */
            $is_shared = in_array($form, self::SHARED_FORMS);
            $sides[] = [
                'side' => $side,
                'offset' => $offset,
                'channels' => array_filter([
                    'form' => $this->normalizeForm($form),
                    'direction' => $this->direction($tags, $side),
                    'separation' => $this->separation($tags, $side, $form),
                    // advisory (ochranný) lanes are marked differently from mandatory ones
                    'lane' => $tags['cycleway:'.$side.':lane'] ?? $tags['cycleway:both:lane'] ?? $tags['cycleway:lane'] ?? null,
                    'shared' => $is_shared,
                    'transit' => $this->isTransit($tags, $form),
                    'surface' => $tags['cycleway:'.$side.':surface'] ?? $tags['cycleway:surface'] ?? null,
                    'width' => $tags['cycleway:'.$side.':width'] ?? $tags['cycleway:width'] ?? null,
                ], function ($value) {
                    return $value !== null and $value !== false;
                }),
            ];
        }

        return $sides;
    }

    /**
     * Tags for the centre feature: the originals minus the cycleway keys already
     * expressed by a side feature, so the two do not draw the same thing twice.
     *
     * @param  array<string, string>  $tags
     * @param  list<array{side: string, offset: int, channels: array<string, mixed>}>  $sides
     * @return array<string, string>
     */
    public function centreTags(array $tags, array $sides): array
    {
        $has_side = false;
        foreach ($sides as $side) {
            if ($side['side'] != 'centre') {
                $has_side = true;
            }
        }
        if (! $has_side) {
            return $tags;
        }
        foreach (array_keys($tags) as $key) {
            foreach (self::CONSUMED as $prefix) {
                if ($key == $prefix or str_starts_with($key, $prefix.':')) {
                    unset($tags[$key]);
                    break;
                }
            }
        }

        return $tags;
    }

    /**
     * cycleway:<side> beats cycleway:both beats cycleway.
     *
     * A bare cycleway=* names both sides of a two-way street, but on a one-way street
     * it means the single lane running with the traffic - which in right-hand traffic
     * is the right-hand side. Reading it as both sides there invents infrastructure.
     *
     * @param  array<string, string>  $tags
     */
    public function form(array $tags, string $side): ?string
    {
        if (isset($tags['cycleway:'.$side])) {
            return $tags['cycleway:'.$side];
        }
        // a :lane marking names a lane whose own cycleway:<side> was never tagged
        if (isset($tags['cycleway:'.$side.':lane'])) {
            return 'lane';
        }
        if (isset($tags['cycleway:both'])) {
            return $tags['cycleway:both'];
        }
        if (isset($tags['cycleway:both:lane'])) {
            return 'lane';
        }
        $bare = $tags['cycleway'] ?? (isset($tags['cycleway:lane']) ? 'lane' : null);
        if ($bare !== null) {
            if (($tags['oneway'] ?? '') == 'yes' and $side == 'left') {
                return null;
            }

            return $bare;
        }

        return null;
    }

    /**
     * forward | backward | two_way — always relative to the way's direction.
     *
     * @param  array<string, string>  $tags
     */
    public function direction(array $tags, string $side): string
    {
        $oneway = $tags['cycleway:'.$side.':oneway'] ?? $tags['cycleway:both:oneway'] ?? null;
        if ($oneway === '-1') {
            return 'backward';
        }
        if ($oneway === 'no') {
            return 'two_way';
        }
        $form = (string) $this->form($tags, $side);
        if (str_starts_with($form, 'opposite')) {
            return 'backward';
        }
        if (($tags['oneway:bicycle'] ?? '') == 'no') {
            return $side == 'left' ? 'backward' : 'forward';
        }
        if (($tags['oneway'] ?? '') == 'yes') {
            return 'forward';
        }

        return $side == 'left' ? 'backward' : 'forward';
    }

    /**
     * kerb | buffer | paint | none — how the infrastructure is held apart from
     * motor traffic. This is the channel that separates "protected" from "painted".
     *
     * @param  array<string, string>  $tags
     */
    public function separation(array $tags, string $side, ?string $form): string
    {
        if ($form == 'track' or $form == 'opposite_track') {
            return 'kerb';
        }
        if (isset($tags['cycleway:'.$side.':buffer']) or isset($tags['cycleway:buffer'])) {
            return 'buffer';
        }
        if ($form == 'lane' or $form == 'opposite_lane') {
            return 'paint';
        }

        return 'none';
    }

    /**
     * Channels for a way that is itself the cycling infrastructure.
     *
     * @param  array<string, string>  $tags
     * @return array<string, mixed>
     */
    private function standaloneChannels(array $tags): array
    {
        $highway = $tags['highway'] ?? '';
        $bicycle = $tags['bicycle'] ?? '';
        if ($highway != 'cycleway' and $bicycle != 'yes' and $bicycle != 'designated' and $bicycle != 'official') {
            return ['form' => 'none'];
        }

        return array_filter([
            'form' => $highway == 'cycleway' ? 'track' : 'tolerated',
            'direction' => ($tags['oneway'] ?? '') == 'yes' ? 'forward' : 'two_way',
            'separation' => $highway == 'cycleway' ? 'kerb' : 'none',
            'segregated' => $tags['segregated'] ?? null,
            'surface' => $tags['cycleway:surface'] ?? $tags['surface'] ?? null,
            'width' => $tags['cycleway:width'] ?? $tags['width'] ?? null,
        ], function ($value) {
            return $value !== null;
        });
    }

    private function isInfrastructure(?string $form): bool
    {
        return $form !== null and in_array($form, self::FORMS);
    }

    /** Bus lanes and tram bodies both end up shared with cyclists; label them apart. */
    private function isTransit(array $tags, ?string $form): ?string
    {
        if ($form != 'share_busway' and $form != 'shared_busway') {
            return null;
        }
        if (($tags['railway'] ?? '') == 'tram' or str_contains($tags['railway:lanes'] ?? '', 'tram')) {
            return 'tram';
        }

        return 'bus';
    }

    /** Collapse the opposite_* legacy forms onto their modern equivalent. */
    private function normalizeForm(string $form): string
    {
        $map = [
            'opposite_lane' => 'lane',
            'opposite_track' => 'track',
            'opposite' => 'lane',
            'shared_busway' => 'share_busway',
            'yes' => 'lane',
        ];

        return $map[$form] ?? $form;
    }
}
