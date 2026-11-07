<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdStatus extends Model
{
    protected $table = 'sd_statuses';

    protected $fillable = [
        'desk_id',
        'name',
        'slug',
        'is_closed',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'is_closed' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }
}
