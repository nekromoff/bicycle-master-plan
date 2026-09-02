<?php

namespace App\Services;

/**
 * Joins consecutive ways that describe the same thing into one path.
 *
 * OSM splits a street wherever any attribute changes - a turn restriction, a lane
 * count, a source tag - so one street arrives as a dozen ways that render
 * identically. Joining them cuts the number of features the browser has to draw
 * and search, and makes a street behave as one object under the pointer.
 *
 * Two ways are joined only when every tag that affects rendering matches, they meet
 * end to start, and nothing else meets them at that point. Ways are never reversed:
 * left and right in OSM are relative to the way's direction, so flipping one would
 * put its cycle lane on the wrong side of the street.
 */
class PathJoiner
{
    /** @var array<int|string, string> signature per path id, so it is computed once */
    private array $signatures = [];

    /**
     * Tag prefixes that decide how a way is drawn. Everything else - sources, notes,
     * turn lanes, survey dates - may differ between two ways that look identical.
     */
    private const RENDERED = [
        'highway', 'cycleway', 'bicycle', 'foot', 'oneway', 'segregated', 'surface',
        'lcn', 'name', 'ref', 'railway', 'embedded_rails', 'sidewalk', 'parking',
        'maxspeed', 'access', 'motor_vehicle', 'tracktype', 'footway', 'path',
        'width', 'lanes', 'bridge', 'tunnel', 'incline', 'area', 'state', 'complete',
    ];

    /**
     * @param  list<array<string, mixed>>  $paths
     * @return list<array<string, mixed>>
     */
    public function join(array $paths): array
    {
        $joinable = [];
        $result = [];
        foreach ($paths as $path) {
            if (! isset($path['nodes']) or count($path['nodes']) < 2) {
                $result[] = $path;

                continue;
            }
            $joinable[$path['id']] = $path;
            $this->signatures[$path['id']] = $this->signature($path);
        }

        // ways that start where another of the same kind ends are the candidates
        $starts = [];
        $ends = [];
        foreach ($joinable as $path) {
            $starts[$this->signatures[$path['id']].'@'.$this->point($path['nodes'][0])][] = $path['id'];
            $ends[$this->signatures[$path['id']].'@'.$this->point($path['nodes'][count($path['nodes']) - 1])][] = $path['id'];
        }

        /*
            Walk each chain from its head, so a chain is never picked up from the middle
            and cut in two. Anything still unvisited afterwards is a closed loop, and is
            seeded on the second pass.
        */
        $used = [];
        $order = [];
        foreach ($joinable as $id => $path) {
            $key = $this->signatures[$path['id']].'@'.$this->point($path['nodes'][0]);
            if (count($ends[$key] ?? []) == 0) {
                $order[] = $id;
            }
        }
        foreach ($joinable as $id => $path) {
            $order[] = $id;
        }

        foreach ($order as $id) {
            $path = $joinable[$id];
            if (isset($used[$id])) {
                continue;
            }
            $used[$id] = true;
            $chain = [$path];
            $current = $path;
            while (true) {
                $key = $this->signatures[$current['id']].'@'.$this->point($current['nodes'][count($current['nodes']) - 1]);
                $candidates = [];
                foreach ($starts[$key] ?? [] as $candidate_id) {
                    if (! isset($used[$candidate_id])) {
                        $candidates[] = $candidate_id;
                    }
                }
                // more than one continuation is a junction, and joining through it would
                // invent a way that does not exist
                if (count($candidates) != 1) {
                    break;
                }
                $current = $joinable[$candidates[0]];
                $used[$current['id']] = true;
                $chain[] = $current;
            }
            $result[] = count($chain) == 1 ? $path : $this->merge($chain);
        }

        return $result;
    }

    /**
     * @param  list<array<string, mixed>>  $chain
     * @return array<string, mixed>
     */
    private function merge(array $chain): array
    {
        $merged = $chain[0];
        $members = [];
        foreach ($chain as $index => $path) {
            $members[] = $path['id'];
            if ($index == 0) {
                continue;
            }
            // the first node repeats the previous way's last one
            $nodes = $path['nodes'];
            array_shift($nodes);
            $merged['nodes'] = array_merge($merged['nodes'], $nodes);
        }
        // every member id keeps resolving, so links shared before the join still open
        $merged['members'] = $members;

        return $merged;
    }

    /** Everything about a way that would make it draw differently. */
    private function signature(array $path): string
    {
        $tags = ($path['info'] ?? []) + ($path['side_tags'] ?? []);
        $relevant = [];
        foreach ($tags as $key => $value) {
            foreach (self::RENDERED as $prefix) {
                if ($key == $prefix or str_starts_with($key, $prefix.':')) {
                    $relevant[$key] = $value;
                    break;
                }
            }
        }
        ksort($relevant);

        return ($path['layer_id'] ?? '').'|'.json_encode($relevant);
    }

    /** @param array{0: float|string, 1: float|string} $node */
    private function point(array $node): string
    {
        return $node[0].','.$node[1];
    }
}
