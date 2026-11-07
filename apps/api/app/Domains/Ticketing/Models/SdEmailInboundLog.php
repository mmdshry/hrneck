<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdEmailInboundLog extends Model
{
    protected $table = 'sd_email_inbound_log';

    protected $fillable = [
        'email_reader_id',
        'message_id',
        'from_email',
        'subject',
        'ticket_id',
        'status',
        'detail',
    ];

    protected function casts(): array
    {
        return [
            'email_reader_id' => 'integer',
            'ticket_id' => 'integer',
        ];
    }

    /** @return BelongsTo<SdEmailReader, $this> */
    public function reader(): BelongsTo
    {
        return $this->belongsTo(SdEmailReader::class, 'email_reader_id');
    }

    /** @return BelongsTo<SdTicket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SdTicket::class, 'ticket_id');
    }
}
