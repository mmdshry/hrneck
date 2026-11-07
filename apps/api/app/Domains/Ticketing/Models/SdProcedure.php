<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdProcedure extends Model
{
    protected $table = 'sd_procedures';

    protected $fillable = [
        'desk_id',
        'stage_id',
        'name',
        'hook',
        'is_active',
        'steps',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'stage_id' => 'integer',
            'is_active' => 'boolean',
            'steps' => 'array',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }

    /** @return BelongsTo<SdStage, $this> */
    public function stage(): BelongsTo
    {
        return $this->belongsTo(SdStage::class, 'stage_id');
    }
}
