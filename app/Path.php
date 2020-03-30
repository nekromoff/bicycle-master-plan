<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Path extends Model
{
    protected $fillable = ['layer_id', 'type', 'lat_start', 'lon_start', 'lat_end', 'lon_end', 'name', 'description', 'filename'];

    public function relations()
    {
        return $this->hasMany('\App\Relation');
    }

    public function layer()
    {
        return $this->belongsTo('\App\Layer');
    }

}
