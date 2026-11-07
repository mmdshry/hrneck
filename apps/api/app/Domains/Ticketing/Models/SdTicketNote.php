<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdTicketNote extends Model
{
    protected $table = 'sd_ticket_notes';

    protected $fillable = [
        'ticket_id',
        'body',
        'is_public',
        'author_user_id',
    ];

    protected function casts(): array
    {
        return [
            'ticket_id' => 'integer',
            'is_public' => 'boolean',
            'author_user_id' => 'integer',
        ];
    }

    /** @return BelongsTo<SdTicket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SdTicket::class, 'ticket_id');
    }
}
