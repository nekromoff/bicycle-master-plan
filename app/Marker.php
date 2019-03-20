<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Marker extends Model
{
    public function relations()
    {
        return $this->hasMany('\App\Relation');
    }

    public function layer()
    {
        return $this->belongsTo('\App\Layer');
    }

}
