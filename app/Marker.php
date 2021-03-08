<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Marker extends Model
{
    protected $fillable = ['layer_id', 'type', 'lat', 'lon', 'name', 'description', 'url', 'filename', 'email', 'approved', 'outdated', 'deleted'];
    protected $hidden = ['approved', 'deleted', 'updated_at'];

    public function relations()
    {
        return $this->hasMany('\App\Relation');
    }

    public function layer()
    {
        return $this->belongsTo('\App\Layer');
    }

    public function markerRelations()
    {
        return $this->hasMany('\App\MarkersRelation')->orderBy('created_at', 'desc');
    }

}
