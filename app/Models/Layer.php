<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Layer extends Model
{
    protected $hidden = ['created_at', 'updated_at'];

    public function markers(): HasMany
    {
        return $this->hasMany(Marker::class);
    }

    public function paths(): HasMany
    {
        return $this->hasMany(Path::class);
    }
}
