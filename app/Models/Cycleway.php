<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cycleway extends Model
{
    protected $fillable = ['sign', 'name', 'description', 'url'];

    protected $hidden = ['created_at', 'updated_at'];

    public function relations(): HasMany
    {
        return $this->hasMany(Relation::class);
    }
}
