<?php

use App\Marker;
use App\Path;
use Illuminate\Database\Seeder;

class PathDistanceSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $csv_file = public_path() . '/sources/distances-paths.csv';
        // 48.190672, 17.037932| 48.178391, 17.051142| Drobného| Harmincova| 4
        $source = file($csv_file);
        foreach ($source as $line) {
            $parts = explode('|', $line);
            $coords_start = explode(',', $parts[0]);
            $coords_end = explode(',', $parts[1]);
            $lat_start = trim($coords_start[0]);
            $lon_start = trim($coords_start[1]);
            $lat_end = trim($coords_end[0]);
            $lon_end = trim($coords_end[1]);
            $point_center = self::getCenterLatLon([['lat' => $lat_start, 'lon' => $lon_start], ['lat' => $lat_end, 'lon' => $lon_end]]);
            $name = trim($parts[2]) . ' - ' . trim($parts[3]);
            $description = trim($parts[4]);
            if (!$coords_start) {
                continue;
            }
            Path::updateOrCreate(['layer_id' => 8, 'type' => 3, 'lat_start' => $lat_start, 'lon_start' => $lon_start, 'lat_end' => $lat_end, 'lon_end' => $lon_end, 'name' => $name], ['description' => $description, 'filename' => '']);
            $marker = Marker::updateOrCreate(['layer_id' => 8, 'type' => 3, 'lat' => $point_center[0], 'lon' => $point_center[1], 'name' => $description], ['description' => 'Minutes: ' . $description, 'filename' => '']);
        }

        $csv_file = public_path() . '/sources/distances-points.csv';
        // Drobného|48.190672, 17.037932
        $source = file($csv_file);
        foreach ($source as $line) {
            $parts = explode('|', $line);
            $name = trim($parts[0]);
            $coords = explode(',', $parts[1]);
            $lat = trim($coords[0]);
            $lon = trim($coords[1]);
            $marker = Marker::updateOrCreate(['layer_id' => 8, 'type' => 3, 'lat' => $lat, 'lon' => $lon, 'name' => $name], ['description' => '', 'filename' => '']);
        }
    }

    private static function getCenterLatLon($coords)
    {
        $count_coords = count($coords);
        $xcos = 0.0;
        $ycos = 0.0;
        $zsin = 0.0;

        foreach ($coords as $lnglat) {
            $lat = $lnglat['lat'] * pi() / 180;
            $lon = $lnglat['lon'] * pi() / 180;

            $acos = cos($lat) * cos($lon);
            $bcos = cos($lat) * sin($lon);
            $csin = sin($lat);
            $xcos += $acos;
            $ycos += $bcos;
            $zsin += $csin;
        }

        $xcos /= $count_coords;
        $ycos /= $count_coords;
        $zsin /= $count_coords;
        $lon = atan2($ycos, $xcos);
        $sqrt = sqrt($xcos * $xcos + $ycos * $ycos);
        $lat = atan2($zsin, $sqrt);

        return array($lat * 180 / pi(), $lon * 180 / pi());
    }
}
