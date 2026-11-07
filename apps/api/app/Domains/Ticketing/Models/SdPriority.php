<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdPriority extends Model
{
    protected $table = 'sd_priorities';

    protected $fillable = [
        'desk_id',
        'name',
        'slug',
        'weight',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'weight' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }
}
