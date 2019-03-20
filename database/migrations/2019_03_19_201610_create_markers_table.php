<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateMarkersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('markers', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('layer_id')->unsigned()->index(); // 1 pasport
            $table->tinyInteger('type')->unsigned()->index(); // 1 road_sign, 2 photo, 3 note
            $table->decimal('lat', 20, 17);
            $table->decimal('lon', 20, 17);
            $table->string('name');
            $table->text('description');
            $table->string('filename');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('markers');
    }
}
