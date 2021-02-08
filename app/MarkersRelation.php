<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class MarkersRelation extends Model
{
    protected $fillable = ['marker_id', 'related_marker_id'];

    public function marker()
    {
        return $this->belongsTo('\App\Marker');
    }

    public function child()
    {
        return $this->belongsTo('\App\Marker', 'related_marker_id');
    }

}
