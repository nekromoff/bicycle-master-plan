<?php

use App\Layer;
use Illuminate\Database\Seeder;

class LayerSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        Layer::updateOrCreate(['id' => 1], ['name' => 'Pasport', 'description' => '']);
    }
}
