<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdSlaPolicy extends Model
{
    protected $table = 'sd_sla_policies';

    protected $fillable = [
        'desk_id',
        'name',
        'goals',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'goals' => 'array',
            'is_default' => 'boolean',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }
}
