<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * The ordinary roads navigation may use between the paths of its layer.
 *
 * The map never draws them, so only what routing needs is kept: the tags that decide
 * the cost and direction of a way, and its points. A point shared by several ways is
 * stored once, and the ways point at it by index - a junction has to stay one exact
 * coordinate, it is what joins the roads to each other and to the layer's own paths.
 *
 * Ways the layer already draws are left out, they would otherwise be counted twice.
 */
class NavigationSupport
{
    /** what routing decides on, and what the cross-section draws the street from */
    private const TAGS = [
        'highway', 'name', 'ref', 'service',
        'oneway', 'oneway:bicycle', 'junction',
        'access', 'vehicle', 'bicycle', 'foot', 'footway', 'segregated', 'motor_vehicle', 'motorcar', 'motorroad',
        'surface', 'maxspeed',
        'bridge', 'tunnel',
        'railway', 'embedded_rails',
    ];

    /** kept with every key below them, e.g. sidewalk:left or parking:both:orientation */
    private const PREFIXES = ['lanes', 'sidewalk', 'parking', 'cycleway'];

    private const TARGET = 'osm/navigation-support.json';

    /**
     * The compact file, rebuilt when it is missing or older than a file it is made of.
     * Null when navigation or its supporting roads are not configured or not fetched yet.
     */
    public function content(): ?string
    {
        $config = config('map.navigation');
        if (! is_array($config) or empty($config['support'])) {
            return null;
        }
        $source = 'osm/'.$config['support'];
        if (! Storage::exists($source)) {
            return null;
        }
        $layers = config('map.layers');
        $layer_file = $layers[$config['layer'] ?? 5]['file'] ?? null;
        $layer_source = $layer_file ? 'osm/'.$layer_file : null;
        if ($layer_source !== null and ! Storage::exists($layer_source)) {
            $layer_source = null;
        }
        $newest = Storage::lastModified($source);
        if ($layer_source !== null) {
            $newest = max($newest, Storage::lastModified($layer_source));
        }
        if (! Storage::exists(self::TARGET) or Storage::lastModified(self::TARGET) < $newest) {
            Storage::put(self::TARGET, json_encode($this->build($source, $layer_source)));
        }

        return Storage::get(self::TARGET);
    }

    /**
     * @return array{points: list<float>, ways: list<array{id: int, n: list<int>, t: object}>}
     */
    public function build(string $source, ?string $layer_source): array
    {
        $drawn = $layer_source !== null ? $this->drawnWays($layer_source) : [];
        $data = json_decode(Storage::get($source));
        $coordinates = [];
        foreach ($data->elements ?? [] as $element) {
            if ($element->type == 'node') {
                $coordinates[$element->id] = [$element->lat, $element->lon];
            }
        }
        // flat lat, lon list; a way's n holds the index of each of its points in it
        $points = [];
        $indexes = [];
        $ways = [];
        foreach ($data->elements ?? [] as $element) {
            if ($element->type != 'way' or isset($drawn[$element->id])) {
                continue;
            }
            $refs = [];
            foreach ($element->nodes ?? [] as $node_id) {
                if (! isset($coordinates[$node_id])) {
                    continue;
                }
                if (! isset($indexes[$node_id])) {
                    $indexes[$node_id] = intdiv(count($points), 2);
                    $points[] = $coordinates[$node_id][0];
                    $points[] = $coordinates[$node_id][1];
                }
                $refs[] = $indexes[$node_id];
            }
            if (count($refs) < 2) {
                continue;
            }
            $ways[] = ['id' => $element->id, 'n' => $refs, 't' => (object) $this->tags((array) ($element->tags ?? []))];
        }

        return ['points' => $points, 'ways' => $ways];
    }

    /**
     * @param  array<string, string>  $tags
     * @return array<string, string>
     */
    private function tags(array $tags): array
    {
        $kept = [];
        foreach ($tags as $key => $value) {
            if (in_array($key, self::TAGS, true)) {
                $kept[$key] = $value;

                continue;
            }
            foreach (self::PREFIXES as $prefix) {
                if ($key == $prefix or str_starts_with($key, $prefix.':')) {
                    $kept[$key] = $value;
                    break;
                }
            }
        }

        return $kept;
    }

    /**
     * Ids of the ways the layer draws, decided the same way the layer decides it.
     *
     * @return array<int|string, true>
     */
    private function drawnWays(string $layer_source): array
    {
        $normalizer = new CyclewayNormalizer;
        $drawn = [];
        $data = json_decode(Storage::get($layer_source));
        foreach ($data->elements ?? [] as $element) {
            if ($element->type == 'way' and isset($element->tags) and $normalizer->isDrawable((array) $element->tags)) {
                $drawn[$element->id] = true;
            }
        }

        return $drawn;
    }
}
