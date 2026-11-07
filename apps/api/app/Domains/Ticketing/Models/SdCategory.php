<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SdCategory extends Model
{
    protected $table = 'sd_categories';

    protected $fillable = [
        'desk_id',
        'name',
        'slug',
        'parent_id',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'parent_id' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }

    /** @return BelongsTo<SdCategory, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(SdCategory::class, 'parent_id');
    }

    /** @return HasMany<SdCategory, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(SdCategory::class, 'parent_id');
    }
}
