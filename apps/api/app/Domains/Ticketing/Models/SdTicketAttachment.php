<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdTicketAttachment extends Model
{
    protected $table = 'sd_ticket_attachments';

    protected $fillable = [
        'ticket_id',
        'disk',
        'path',
        'original_name',
        'mime',
        'size',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [
            'ticket_id' => 'integer',
            'size' => 'integer',
            'uploaded_by' => 'integer',
        ];
    }

    /** @return BelongsTo<SdTicket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SdTicket::class, 'ticket_id');
    }
}
