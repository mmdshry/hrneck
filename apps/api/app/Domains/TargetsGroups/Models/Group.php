<?php

namespace App\Domains\TargetsGroups\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Group extends Model
{
    protected $fillable = ['name', 'status', 'source', 'external_id'];

    public function targets(): BelongsToMany
    {
        return $this->belongsToMany(Target::class);
    }
}
