<?php

namespace Database\Seeders;

use App\Marker;
use Illuminate\Database\Seeder;

class PhotosSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $photos = Storage::files('public/photos/');
        foreach ($photos as $photo) {
            if (stripos($photo, 'jpg') !== false) {
                $exif = exif_read_data(storage_path('app/') . $photo);
                $lat = str_replace('/1', '', $exif['GPSLatitude'][0]) + (str_replace('/1', '', $exif['GPSLatitude'][1]) + str_replace('/100', '', $exif['GPSLatitude'][2]) / 100 / 60) / 60;
                $lon = str_replace('/1', '', $exif['GPSLongitude'][0]) + (str_replace('/1', '', $exif['GPSLongitude'][1]) + str_replace('/100', '', $exif['GPSLongitude'][2]) / 100 / 60) / 60;
                $photo = str_replace('public/photos/', '', $photo);
                dd($photo);
                $marker = Marker::updateOrCreate(['layer_id' => 1, 'type' => 2, 'lat' => $lat, 'lon' => $lon, 'name' => str_replace('photos/', '', $photo)], ['description' => '', 'filename' => str_replace('photos/', '', $photo)]);
                echo 'created ' . $photo . "\n";
            }
        }
    }
}
