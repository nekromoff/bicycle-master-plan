<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Relation extends Model
{
    protected $fillable = ['marker_id', 'cycleway_id'];

    protected $hidden = ['created_at', 'updated_at'];

    public function marker(): BelongsTo
    {
        return $this->belongsTo(Marker::class);
    }

    public function cycleway(): BelongsTo
    {
        return $this->belongsTo(Cycleway::class);
    }
}
