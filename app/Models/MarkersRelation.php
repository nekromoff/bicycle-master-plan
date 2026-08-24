<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarkersRelation extends Model
{
    protected $fillable = ['marker_id', 'related_marker_id'];

    public function marker(): BelongsTo
    {
        return $this->belongsTo(Marker::class);
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Marker::class, 'related_marker_id');
    }
}
