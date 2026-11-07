<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdStage extends Model
{
    protected $table = 'sd_stages';

    protected $fillable = [
        'desk_id',
        'name',
        'sequence',
        'default_escalation_minutes',
        'is_terminal',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'sequence' => 'integer',
            'default_escalation_minutes' => 'integer',
            'is_terminal' => 'boolean',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }
}
