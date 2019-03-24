<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Cycleway extends Model
{
    protected $fillable = ['sign', 'name', 'description', 'url'];

    public function relations()
    {
        return $this->hasMany('\App\Relation');
    }

}
