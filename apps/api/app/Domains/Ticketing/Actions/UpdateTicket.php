<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Notifications\Actions\NotifyTicketAssignee;
use App\Domains\Ticketing\Models\SdStage;
use App\Domains\Ticketing\Models\SdTicket;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class UpdateTicket
{
    public function __construct(private readonly RunProcedure $procedures) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(SdTicket $ticket, array $data, ?int $actorUserId = null, bool $forceUnlock = false): SdTicket
    {
        if ($ticket->locked_by && (int) $ticket->locked_by !== (int) $actorUserId && ! $forceUnlock) {
            throw ValidationException::withMessages([
                'ticket' => ['Ticket is locked by another user.'],
            ]);
        }

        $previousStage = $ticket->stage_id;
        $previousAssignee = $ticket->assignee_user_id !== null ? (int) $ticket->assignee_user_id : null;

        $fillable = [
            'summary', 'description', 'stage_id', 'status_id', 'priority_id', 'severity_id',
            'category_id', 'requester_user_id', 'requester_target_id', 'assignee_user_id',
            'assignee_pool', 'custom_fields', 'is_unread',
        ];

        foreach ($fillable as $key) {
            if (array_key_exists($key, $data)) {
                $ticket->{$key} = $data[$key];
            }
        }

        if (array_key_exists('stage_id', $data) && (int) $data['stage_id'] !== (int) $previousStage) {
            $stage = SdStage::query()->find((int) $data['stage_id']);
            $ticket->escalation_level = 0;
            $ticket->escalation_due_at = $stage?->default_escalation_minutes
                ? Carbon::now()->addMinutes((int) $stage->default_escalation_minutes)
                : null;
            if ($stage?->is_terminal) {
                $ticket->resolved_at ??= Carbon::now();
            }
        }

        if (! empty($data['mark_responded']) && ! $ticket->first_responded_at) {
            $ticket->first_responded_at = Carbon::now();
        }

        $ticket->updated_by = $actorUserId;
        $ticket->locked_by = $actorUserId;
        $ticket->locked_at = Carbon::now();
        $ticket->save();

        if (array_key_exists('stage_id', $data) && (int) $data['stage_id'] !== (int) $previousStage) {
            $this->procedures->handle($ticket, 'on_stage_enter', (int) $ticket->stage_id);
        }

        $fresh = $ticket->fresh(['desk', 'stage', 'status', 'priority', 'severity', 'category', 'notes', 'tasks', 'links', 'attachments'])
            ?? $ticket;

        if (array_key_exists('assignee_user_id', $data)) {
            app(NotifyTicketAssignee::class)->handle($fresh, $previousAssignee);
        }

        return $fresh;
    }
}
