<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdTicketLink extends Model
{
    protected $table = 'sd_ticket_links';

    protected $fillable = [
        'ticket_id',
        'related_type',
        'related_id',
        'link_type',
    ];

    protected function casts(): array
    {
        return [
            'ticket_id' => 'integer',
            'related_id' => 'integer',
        ];
    }

    /** @return BelongsTo<SdTicket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SdTicket::class, 'ticket_id');
    }
}
