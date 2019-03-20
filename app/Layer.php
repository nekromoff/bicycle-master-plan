<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Layer extends Model
{
    public function markers()
    {
        return $this->hasMany('\App\Marker');
    }

}
