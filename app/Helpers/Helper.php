<?php

namespace App\Helpers;

use Auth;

class Helper
{
    public static function getEditableLayerId()
    {
        foreach (config('map.layers') as $layer_id => $layer) {
            if (isset($layer['editable']) and $layer['editable']) {
                return $layer_id;
            }
        }
        return false;
    }

    public static function getEditableLayerTypes()
    {
        if (self::getEditableLayerId()) {
            return config('map.layers')[self::getEditableLayerId()]['editable_types'];
        }
        return false;
    }

    public static function getEditableLayerAllowedUploadFiletypes()
    {
        if (self::getEditableLayerId()) {
            return config('map.layers')[self::getEditableLayerId()]['allowed_filetypes'];
        }
        return false;
    }

    public static function getFilename($layer_id, $filename, $thumb = true)
    {
        // URL
        if (stripos($filename, 'http://') !== false or stripos($filename, 'https://') !== false) {
            $url = $filename;
        } else {
            // default path to file in storage
            $path = 'storage/';
            if ($layer_id == self::getEditableLayerId()) {
                $path = $path . 'uploads/';
            } else {
                $path = $path . 'photos/';
                if ($thumb) {
                    $path = $path . 'thumbs/';
                }
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
                    echo "'" . $type['name'] . "': core.layers.layer" . $layer_id . '_type' . $type_id;
                    if ($counter_type < count($layer_config[$layer_id]['types']) - 1) {
                        echo ', ';
                    }
                    $counter_type++;
                }
            } else {
                echo "'" . $layer_config[$layer_id]['name'] . "': core.layers.layer";
                // if ($layer_config[$layer_id]['type'] == 'path') {
                //     echo 'path';
                // }
                echo $layer_id;
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
                        echo 'core.clusters.layer' . $layer_id . '_type' . $type_id . '.checkIn(core.layers.layer' . $layer_id . '_type' . $type_id . ');' . "\n";
                        echo 'core.clusters.layer' . $layer_id . '_type' . $type_id . '.addTo(map);' . "\n";
                    }
                }
            } elseif (isset($layer_config[$layer_id]['cluster']) and $layer_config[$layer_id]['cluster'] == true) {
                echo 'core.clusters.layer' . $layer_id . '.checkIn(core.layers.layer' . $layer_id . ');' . "\n";
                echo 'core.clusters.layer' . $layer_id . '.addTo(map);' . "\n";
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

    public static function jsSetupUI()
    {
        $code = 'L.easyButton("<span data-toggle=\"tooltip\" data-placement=\"top\" title=\""+ i18n("Help")+"\">❓</span>", function() { openSidebar("' . addslashes(config('map.intro')) . '"); }).addTo(map); ';
        if (config('map.admins')) {
            $user = Auth::user();
            if (!$user) {
                $code .= 'L.easyButton("<span data-toggle=\"tooltip\" data-placement=\"top\" title=\""+ i18n("Login")+"\">🔑</span>", function() { window.location.assign("' . route('login', ['provider' => 'google']) . '") }).addTo(map);';
            } elseif ($user and in_array($user->email, config('map.admins')) === true) {
                $code .= 'L.easyButton("<span data-toggle=\"tooltip\" data-placement=\"top\" title=\""+ i18n("Administration")+"\">🖉</span>", function() { window.location.assign("' . route('admin') . '") }).addTo(map);';
            }
            echo $code;
        }
    }
}
