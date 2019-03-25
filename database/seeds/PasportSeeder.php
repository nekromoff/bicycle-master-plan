<?php

use App\Cycleway;
use App\Marker;
use App\Relation;
use Illuminate\Database\Seeder;

class PasportSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $csv_file = public_path() . '/sources/2018-4.csv';
        $source = file($csv_file);
        /* 019|lat="48.191105034202337" lon="17.135139992460608"|C8|C8X|||||R13|
         */
        foreach ($source as $line) {
            $parts = explode('|', $line);
            $id = trim($parts[0]);
            $coords = trim($parts[1]);
            if (!$id or !$coords) {
                continue;
            }
            $id = $id * 1;
            if (stripos($coords, 'lat') !== false) {
                $coords = explode(' ', $coords);
                $lat = trim(str_replace(',', '', str_replace('"', '', str_replace('lat="', '', $coords[0]))));
                $lon = trim(str_replace(',', '', str_replace('"', '', str_replace('lon="', '', $coords[1]))));
            } elseif (stripos($coords, 'N') !== false) {
                // N48° 09.343' E17° 06.161'
                $coords = explode(' ', $coords);
                $deg = trim(str_replace('°', '', str_replace('N', '', $coords[0])));
                $min = trim(str_replace("'", '', $coords[1]));
                $lat = $deg + $min / 100;
                $deg = trim(str_replace('°', '', str_replace('E', '', $coords[2])));
                $min = trim(str_replace("'", '', $coords[3]));
                $lon = $deg + $min / 100;
            } else {
                $coords = explode(',', $coords);
                $lat = trim(str_replace('"', '', $coords[0]));
                $lon = trim(str_replace('"', '', $coords[1]));
            }
            $note = trim($parts[7]);
            for ($i = 2; $i <= 6; $i++) {
                if (trim($parts[$i])) {
                    $marker = Marker::updateOrCreate(['layer_id' => 1, 'type' => 1, 'lat' => $lat, 'lon' => $lon, 'name' => trim($parts[$i])], ['description' => $note, 'filename' => '']);
                    for ($o = 8; $o < count($parts); $o++) {
                        if (trim($parts[$o])) {
                            $cycleway = Cycleway::updateOrCreate(['sign' => trim($parts[$o])], ['name' => trim($parts[$o]), 'description' => '', 'url' => '']);
                            Relation::updateOrCreate(['marker_id' => $marker->id, 'cycleway_id' => $cycleway->id]);
                        }
                    }
                }
            }

        }
    }
}
