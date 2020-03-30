<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddFieldsToPathsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('paths', function (Blueprint $table) {
            $table->integer('layer_id')->unsigned()->index(); // 1 pasport
            $table->tinyInteger('type')->unsigned()->index(); // 1 road_sign, 2 photo, 3 note
            $table->decimal('lat_start', 20, 17);
            $table->decimal('lon_start', 20, 17);
            $table->decimal('lat_end', 20, 17);
            $table->decimal('lon_end', 20, 17);
            $table->string('name');
            $table->text('description');
            $table->string('filename');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('paths', function (Blueprint $table) {
            $table->dropColumn('layer_id');
            $table->dropColumn('type');
            $table->dropColumn('lat_start', 20, 17);
            $table->dropColumn('lon_start', 20, 17);
            $table->dropColumn('lat_end', 20, 17);
            $table->dropColumn('lon_end', 20, 17);
            $table->dropColumn('name');
            $table->dropColumn('description');
            $table->dropColumn('filename');
        });
    }
}
