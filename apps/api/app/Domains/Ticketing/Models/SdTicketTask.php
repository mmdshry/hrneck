<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdTicketTask extends Model
{
    protected $table = 'sd_ticket_tasks';

    protected $fillable = [
        'ticket_id',
        'title',
        'description',
        'assignee_user_id',
        'hours_worked',
        'is_completed',
        'completed_at',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'ticket_id' => 'integer',
            'assignee_user_id' => 'integer',
            'hours_worked' => 'decimal:2',
            'is_completed' => 'boolean',
            'completed_at' => 'datetime',
            'sort_order' => 'integer',
        ];
    }

    /** @return BelongsTo<SdTicket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SdTicket::class, 'ticket_id');
    }
}
