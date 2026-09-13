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
     * What has to match before two ways are the same thing.
     *
     * The name is the primary signal, together with the tags that describe cycling on
     * the way. Everything else - lane counts, surface, maxspeed, sidewalks, parking,
     * turn restrictions, sources - may differ freely: OSM splits a street on any of
     * them, and those splits are what this is here to undo.
     *
     * The way type stays in, because it decides which branch draws the way at all: a
     * street and a cycleway of the same name are not one line. So does ref, which on a
     * route relation is the route number - two different routes must not become one.
     *
     * Bridges and tunnels stay separate ways as well, so that where they start and end
     * is still known - navigation may only step on and off them at their ends.
     */
    private const RENDERED = [
        'name',
        'highway', 'footway', 'path', 'railway', 'embedded_rails',
        'bridge', 'tunnel',
        'cycleway', 'bicycle', 'segregated', 'foot', 'oneway',
        'lcn', 'lcn_ref', 'rcn_ref', 'ncn_ref', 'ref', 'network', 'route',
        'state', 'complete',
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
        $base = $this->tags($chain[0]);
        $members = [];
        $parts = [];
        foreach ($chain as $index => $path) {
            $members[] = $path['id'];
            if ($index > 0) {
                // the first node repeats the previous way's last one
                $nodes = $path['nodes'];
                array_shift($nodes);
                $merged['nodes'] = array_merge($merged['nodes'], $nodes);
            }
            /*
                The joined way is drawn from the first member's tags, so anything the
                other members say differently would otherwise be lost. Only what differs
                is kept - the rest is already in the way's own tag list.
            */
            $different = [];
            foreach ($this->tags($path) as $key => $value) {
                if (! isset($base[$key]) or $base[$key] !== $value) {
                    $different[$key] = $value;
                }
            }
            if ($different) {
                $parts[] = ['id' => $path['id'], 'tags' => $different];
            }
        }
        // every member id keeps resolving, so links shared before the join still open
        $merged['members'] = $members;
        if ($parts) {
            $merged['parts'] = $parts;
        }

        return $merged;
    }

    /** A way's whole tag set, with the keys moved onto its side features put back. */
    private function tags(array $path): array
    {
        return ($path['info'] ?? []) + ($path['side_tags'] ?? []);
    }

    /** Everything about a way that would make it draw differently. */
    private function signature(array $path): string
    {
        $tags = $this->tags($path);
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
