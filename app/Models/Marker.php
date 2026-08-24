<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Marker extends Model
{
    protected $fillable = ['layer_id', 'type', 'lat', 'lon', 'name', 'description', 'url', 'filename', 'email', 'approved', 'outdated', 'deleted'];

    protected $hidden = ['approved', 'deleted', 'updated_at'];

    public function relations(): HasMany
    {
        return $this->hasMany(Relation::class);
    }

    public function layer(): BelongsTo
    {
        return $this->belongsTo(Layer::class);
    }

    public function markerRelations(): HasMany
    {
        return $this->hasMany(MarkersRelation::class)->orderBy('created_at', 'desc');
    }
}
