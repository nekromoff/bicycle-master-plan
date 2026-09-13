<?php

namespace App\Helpers;

use Illuminate\Support\Facades\Auth;

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
            return config('map.layers')[self::getEditableLayerId()]['types'];
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
                    if (isset($type['cluster']) and $type['cluster'] == true) {
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

    /**
     * The intro in the map's own language. map.intro is one text, or one per language
     * (['sk' => '...', 'en' => '...']); the page switches between them with introContent().
     */
    public static function intro(?string $language = null): string
    {
        $intro = config('map.intro');
        if (! is_array($intro)) {
            return (string) $intro;
        }
        $language = $language ?? config('map.language');

        return (string) ($intro[$language] ?? reset($intro));
    }

    public static function jsSetupUI()
    {
        $code = 'L.easyButton("<span data-toggle=\"tooltip\" data-placement=\"right\" data-i18n-title=\"Help\" title=\""+ i18n("Help")+"\">❓</span>", function() { toggleHelp(introContent()); }).addTo(map); ';
        // beside help, the language the page is in, when there is more than one to choose from
        $code .= 'if (core.languages.length > 1) { var language_button = L.easyButton("<span class=\"language-code\" data-toggle=\"tooltip\" data-placement=\"right\" data-i18n-title=\"Language\" title=\""+ i18n("Language")+"\">"+ core.config.language.toUpperCase() +"</span>", function(control) { openLanguageMenu(control.button); }).addTo(map); var language_bar = language_button.button.parentNode; language_bar.classList.add("language-control"); if (language_bar.previousElementSibling) { language_bar.previousElementSibling.classList.add("language-joined"); } } ';
        if (config('map.admins')) {
            $user = Auth::user();
            if (!$user) {
                $code .= 'L.easyButton("<span data-toggle=\"tooltip\" data-placement=\"right\" data-i18n-title=\"Login\" title=\""+ i18n("Login")+"\">🔑</span>", function() { window.location.assign("' . route('login', ['provider' => 'google']) . '") }, {position: "bottomleft"}).addTo(map);';
            } elseif ($user and in_array($user->email, config('map.admins')) === true) {
                $code .= 'L.easyButton("<span data-toggle=\"tooltip\" data-placement=\"right\" data-i18n-title=\"Administration\" title=\""+ i18n("Administration")+"\">🖉</span>", function() { window.location.assign("' . route('admin') . '") }, {position: "bottomleft"}).addTo(map);';
            }
        }
        echo $code;
    }
}
