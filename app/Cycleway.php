<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Cycleway extends Model
{
    public function relations()
    {
        return $this->hasMany('\App\Relation');
    }

}
