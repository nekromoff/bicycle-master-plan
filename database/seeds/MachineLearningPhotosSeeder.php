<?php

namespace Database\Seeders;

use App\Marker;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

class MachineLearningPhotosSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $count = 0;
        $photos = Storage::files('public/photos/ml/');
        foreach ($photos as $photo) {
            if (stripos($photo, 'box.jpg') !== false) {
                $filename = str_ireplace('_box.jpg', '_info.json', $photo);
                $info = json_decode(Storage::get($filename), true);
                if ($info[0]['Score'] >= 0.8) {
                    $filename = str_ireplace('_box.jpg', '_exif.json', $photo);
                    if (Storage::exists($filename)) {
                        $count++;
                        $exif = json_decode(Storage::get($filename), true);
                        //  "GPSLatitude": "48 deg 10' 58.51\" N",
                        $parts = explode(' ', $exif[0]['GPSLatitude']);
                        $lat = self::DMStoDD(trim($parts[0]), str_replace("'", '', $parts[2]), str_replace('"', '', $parts[3]));
                        $parts = explode(' ', $exif[0]['GPSLongitude']);
                        $lon = self::DMStoDD(trim($parts[0]), str_replace("'", '', $parts[2]), str_replace('"', '', $parts[3]));
                        // road sign layer
                        $marker = Marker::updateOrCreate(['layer_id' => 1, 'type' => 1, 'lat' => $lat, 'lon' => $lon, 'name' => $info[0]['SignName']], ['description' => '', 'filename' => str_replace('public/photos/ml/', '', $photo), 'url' => '', 'email' => '', 'approved' => 1, 'outdated' => 0, 'deleted' => 0]);
                        Storage::copy($photo, Storage::copy($photo, str_ireplace('ml/', '', $photo)););
                        echo 'created ' . $info[0]['SignName'] . ' with score ' . $info[0]['Score'] . ' at ' . $lat . ',' . $lon . "\n";
                    }
                }
            }
        }
        dd($count);
    }

    private static function DMStoDD($deg, $min, $sec)
    {
        // Converting DMS ( Degrees / minutes / seconds ) to decimal format
        return $deg + ((($min * 60) + ($sec)) / 3600);
    }

}
