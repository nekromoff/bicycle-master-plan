<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Relation extends Model
{
    protected $fillable = ['marker_id', 'cycleway_id'];

    public function marker()
    {
        return $this->belongsTo('\App\Marker');
    }

    public function cycleway()
    {
        return $this->belongsTo('\App\Cycleway');
    }

}
