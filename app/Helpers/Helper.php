<?php

namespace App\Helpers;

use Auth;

class Helper
{
    public static function getFilename($filename, $thumb = true)
    {
        // URL
        if (stripos($filename, 'http://') !== false or stripos($filename, 'https://') !== false) {
            $url = $filename;
        } else {
            // file in storage
            $path = 'storage/photos/thumbs/';
            if (!$thumb) {
                $path = 'storage/photos/';
            }
            $url = asset($path . $filename);
        }
        return $url;
    }

    public static function jsGetOverlays()
    {
        $layer_config = config('map.layers');
        $counter = 0;
        foreach ($layer_config as $layer_id => $layer) {
            // skip base layer
            if ($layer_id == 0) {
                continue;
            }
            if (isset($layer_config[$layer_id]['types'])) {
                $counter_type = 0;
                foreach ($layer_config[$layer_id]['types'] as $type_id => $type) {
                    echo "'" . $type['name'] . "': layer" . $layer_id . '_type' . $type_id;
                    if ($counter_type < count($layer_config[$layer_id]['types']) - 1) {
                        echo ', ';
                    }
                    $counter_type++;
                }
            } else {
                echo "'" . $layer_config[$layer_id]['name'] . "': layer";
                if ($layer_config[$layer_id]['type'] == 'path') {
                    echo 'path';
                }
                echo $layer_id . '_type0';
            }
            if ($counter < count($layer_config) - 2) {
                echo ', ';
            }
            $counter++;
        }
    }

    public static function jsSetupClusters()
    {
        $layer_config = config('map.layers');
        foreach ($layer_config as $layer_id => $layer) {
            if (isset($layer_config[$layer_id]['types'])) {
                foreach ($layer_config[$layer_id]['types'] as $type_id => $type) {
                    if ($type['cluster'] == true) {
                        echo 'clusters_layer' . $layer_id . '_type' . $type_id . '.checkIn(layer' . $layer_id . '_type' . $type_id . ');' . "\n";
                        echo 'clusters_layer' . $layer_id . '_type' . $type_id . '.addTo(map);' . "\n";
                    }
                }
            } elseif (isset($layer_config[$layer_id]['cluster']) and $layer_config[$layer_id]['cluster'] == true) {
                echo 'clusters_layer' . $layer_id . '_type0.checkIn(layer' . $layer_id . '_type0);' . "\n";
                echo 'clusters_layer' . $layer_id . '_type0.addTo(map);' . "\n";
            }
        }
    }

    public static function jsGetOptions($options)
    {
        $count = count($options) - 1;
        foreach ($options as $key => $value) {
            echo "'", $key, "': '", $value, "'";
            if ($key != $count) {
                echo ', ';
            }
            echo "\n";
        }
    }

    public static function jsGetPath($path)
    {
        setlocale(LC_CTYPE, 'sk_SK.UTF-8');
        $layer_config = config('map.layers');
        $code = 'L.polyline([';
        $counter = 0;
        $count = count($path['nodes']);
        foreach ($path['nodes'] as $node) {
            $code .= '[' . $node[0] . ',' . $node[1] . ']';
            if ($counter < $count - 1) {
                $code .= ',';
            }
            $counter++;
        }
        $code .= '], { className: \'path';
        foreach ($path['info'] as $key => $value) {
            $code .= ' ' . preg_replace('/[^A-Za-z0-9_]/', '-', $key) . '-' . preg_replace('/[^A-Za-z0-9_]/', '-', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $value)));
        }
        $code .= '\'})';
        if (isset($path['info'])) {
            $code .= '.bindPopup(\'';
            if (isset($path['info']['name'])) {
                $code .= '<strong>' . $path['info']['name'] . '</strong>';
            }
            if (isset($path['info']['ref'])) {
                $code .= '<br>Číslo trasy: ' . $path['info']['ref'];
            }
            if (isset($path['info']['operator'])) {
                $code .= '<br>Správca: ' . $path['info']['operator'];
            }
            foreach ($path['info'] as $key => $value) {
                $code .= '<br>' . $key . '=' . $value;
            }
        }
        $code .= '\').addTo(layer' . $path['layer_id'] . '_type0);';
        echo $code;
    }

    public static function jsGetMarker($marker, $cycleways)
    {
        $layer_config = config('map.layers');
        $code = 'L.marker([' . $marker->lat . ',' . $marker->lon . '], { icon: new L.DivIcon({ html: \'<div class="';
        $normalized = strtolower(preg_replace('/[0-9]/', '', $marker->name));
        // multiple types
        if (isset($layer_config[$marker->layer_id]['types'])) {
            $code .= $layer_config[$marker->layer_id]['types'][$marker->type]['class'] . ' ' . $normalized . '">';
            if (isset($layer_config[$marker->layer_id]['types'][$marker->type]['icon'])) {
                if ($layer_config[$marker->layer_id]['types'][$marker->type]['icon'] == 'name') {
                    $code .= $marker->name . '</div>';
                } elseif ($layer_config[$marker->layer_id]['types'][$marker->type]['icon'] == 'filename') {
                    $code .= '<img src="' . Helper::getFilename($marker->filename) . '" alt="' . $marker->filename . '">';
                }
            }
        } else {
            // flat
            $code .= $layer_config[$marker->layer_id]['class'] . ' ' . $normalized . '">';
            if (isset($layer_config[$marker->layer_id]['icon'])) {
                if ($layer_config[$marker->layer_id]['icon'] == 'name') {
                    $code .= $marker->name . '</div>';
                } elseif ($layer_config[$marker->layer_id]['icon'] == 'filename') {
                    $code .= '<img src="' . Helper::getFilename($marker->filename) . '" alt="' . $marker->filename . '">';
                }
            }
        }
        $code .= '</div>\' }) }).bindPopup(\'' . $marker->name;
        if ($marker->description) {
            $code .= '<br>' . $marker->description;
        }
        if ($marker->filename) {
            $code .= '<br><a href="' . Helper::getFilename($marker->filename, false) . '" target="_blank"><img src="' . Helper::getFilename($marker->filename) . '" alt="' . $marker->filename . '"></a>';
        }
        if (isset($marker->relations) and count($marker->relations)) {
            $code .= '<br>Číslo trasy: ';
            $count = count($marker->relations) - 1;
            foreach ($marker->relations as $key => $relation) {
                $code .= $cycleways[$relation->cycleway_id]->sign;
                if ($key != $count) {
                    $code .= ', ';
                }
            }
        }
        if (isset($layer_config[$marker->layer_id]['types'])) {
            $code .= '\').addTo(layer' . $marker->layer_id . '_type' . $marker->type . ');';
        } else {
            $code .= '\').addTo(layer' . $marker->layer_id . '_type0);';
        }
        echo $code;
    }
}
