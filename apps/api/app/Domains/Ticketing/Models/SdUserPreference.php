<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdUserPreference extends Model
{
    protected $table = 'sd_user_preferences';

    protected $fillable = [
        'user_id',
        'email_send_delay_minutes',
        'default_desk_id',
        'default_filters',
        'ticket_scope',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'email_send_delay_minutes' => 'integer',
            'default_desk_id' => 'integer',
            'default_filters' => 'array',
        ];
    }

    /** @return BelongsTo<SdDesk, $this> */
    public function defaultDesk(): BelongsTo
    {
        return $this->belongsTo(SdDesk::class, 'default_desk_id');
    }
}
