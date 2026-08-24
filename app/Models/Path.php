<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Path extends Model
{
    protected $fillable = ['layer_id', 'type', 'lat_start', 'lon_start', 'lat_end', 'lon_end', 'name', 'description', 'filename'];

    protected $hidden = ['created_at', 'updated_at'];

    public function relations(): HasMany
    {
        return $this->hasMany(Relation::class);
    }

    public function layer(): BelongsTo
    {
        return $this->belongsTo(Layer::class);
    }
}
