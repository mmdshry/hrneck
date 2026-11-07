<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdNoteTemplate extends Model
{
    protected $table = 'sd_note_templates';

    protected $fillable = [
        'desk_id',
        'name',
        'body',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function desk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'desk_id');
    }
}
