<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Layer extends Model
{
    protected $hidden = ['created_at', 'updated_at'];

    public function markers()
    {
        return $this->hasMany('\App\Marker');
    }

    public function paths()
    {
        return $this->hasMany('\App\Path');
    }

}
