<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Marker extends Model
{
    protected $fillable = ['layer_id', 'type', 'lat', 'lon', 'name', 'description', 'filename'];
    protected $hidden = ['created_at', 'updated_at'];

    public function relations()
    {
        return $this->hasMany('\App\Relation');
    }

    public function layer()
    {
        return $this->belongsTo('\App\Layer');
    }

}
