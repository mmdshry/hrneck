<?php

namespace App\Domains\Ticketing\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SdTicket extends Model
{
    protected $table = 'sd_tickets';

    protected $fillable = [
        'desk_id',
        'number',
        'summary',
        'description',
        'stage_id',
        'status_id',
        'priority_id',
        'severity_id',
        'category_id',
        'requester_user_id',
        'requester_target_id',
        'assignee_user_id',
        'assignee_pool',
        'escalation_level',
        'escalation_due_at',
        'first_responded_at',
        'resolved_at',
        'sla_response_due_at',
        'sla_resolve_due_at',
        'sla_response_breached',
        'sla_resolve_breached',
        'locked_by',
        'locked_at',
        'archived_at',
        'is_unread',
        'custom_fields',
        'pending_notification_at',
        'merged_into_id',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'desk_id' => 'integer',
            'stage_id' => 'integer',
            'status_id' => 'integer',
            'priority_id' => 'integer',
            'severity_id' => 'integer',
            'category_id' => 'integer',
            'requester_user_id' => 'integer',
            'requester_target_id' => 'integer',
            'assignee_user_id' => 'integer',
            'escalation_level' => 'integer',
            'escalation_due_at' => 'datetime',
            'first_responded_at' => 'datetime',
            'resolved_at' => 'datetime',
            'sla_response_due_at' => 'datetime',
            'sla_resolve_due_at' => 'datetime',
            'sla_response_breached' => 'boolean',
            'sla_resolve_breached' => 'boolean',
            'locked_by' => 'integer',
            'locked_at' => 'datetime',
            'archived_at' => 'datetime',
            'is_unread' => 'boolean',
            'custom_fields' => 'array',
            'pending_notification_at' => 'datetime',
            'merged_into_id' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
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

    /** @return BelongsTo<SdStatus, $this> */
    public function status(): BelongsTo
    {
        return $this->belongsTo(SdStatus::class, 'status_id');
    }

    /** @return BelongsTo<SdPriority, $this> */
    public function priority(): BelongsTo
    {
        return $this->belongsTo(SdPriority::class, 'priority_id');
    }

    /** @return BelongsTo<SdSeverity, $this> */
    public function severity(): BelongsTo
    {
        return $this->belongsTo(SdSeverity::class, 'severity_id');
    }

    /** @return BelongsTo<SdCategory, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(SdCategory::class, 'category_id');
    }

    /** @return HasMany<SdTicketNote, $this> */
    public function notes(): HasMany
    {
        return $this->hasMany(SdTicketNote::class, 'ticket_id')->latest();
    }

    /** @return HasMany<SdTicketTask, $this> */
    public function tasks(): HasMany
    {
        return $this->hasMany(SdTicketTask::class, 'ticket_id')->orderBy('sort_order');
    }

    /** @return HasMany<SdTicketAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(SdTicketAttachment::class, 'ticket_id');
    }

    /** @return HasMany<SdTicketLink, $this> */
    public function links(): HasMany
    {
        return $this->hasMany(SdTicketLink::class, 'ticket_id');
    }

    /** @param Builder<SdTicket> $query */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at')->whereNull('merged_into_id');
    }

    /** @param Builder<SdTicket> $query */
    public function scopeArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }
}
