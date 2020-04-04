<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Cycleway extends Model
{
    protected $fillable = ['sign', 'name', 'description', 'url'];
    protected $hidden = ['created_at', 'updated_at'];

    public function relations()
    {
        return $this->hasMany('\App\Relation');
    }

}
