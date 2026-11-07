<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdProcedure;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketNote;
use Illuminate\Support\Carbon;

class RunProcedure
{
    /**
     * @param  list<SdProcedure>|null  $procedures
     */
    public function handle(SdTicket $ticket, string $hook, ?int $stageId = null, ?iterable $procedures = null): void
    {
        $query = SdProcedure::query()
            ->where('desk_id', $ticket->desk_id)
            ->where('hook', $hook)
            ->where('is_active', true);

        if ($stageId !== null) {
            $query->where(function ($q) use ($stageId): void {
                $q->whereNull('stage_id')->orWhere('stage_id', $stageId);
            });
        }

        $list = $procedures ?? $query->get();

        foreach ($list as $procedure) {
            if ($stageId !== null && $procedure->stage_id !== null && (int) $procedure->stage_id !== $stageId) {
                continue;
            }
            foreach ($procedure->steps ?? [] as $step) {
                $this->applyStep($ticket, is_array($step) ? $step : []);
            }
        }

        $ticket->save();
    }

    /** @param array<string, mixed> $step */
    private function applyStep(SdTicket $ticket, array $step): void
    {
        $action = (string) ($step['action'] ?? '');

        switch ($action) {
            case 'assign_pool':
                $ticket->assignee_pool = (string) ($step['pool'] ?? $ticket->assignee_pool);
                break;
            case 'assign_user':
                $ticket->assignee_user_id = isset($step['user_id']) ? (int) $step['user_id'] : null;
                break;
            case 'set_field':
                $field = (string) ($step['field'] ?? '');
                if ($field !== '' && in_array($field, $ticket->getFillable(), true)) {
                    $ticket->{$field} = $step['value'] ?? null;
                }
                break;
            case 'add_note':
                SdTicketNote::query()->create([
                    'ticket_id' => $ticket->id,
                    'body' => (string) ($step['body'] ?? ''),
                    'is_public' => (bool) ($step['is_public'] ?? false),
                    'author_user_id' => null,
                ]);
                break;
            case 'set_escalation_minutes':
                $minutes = (int) ($step['minutes'] ?? 0);
                $ticket->escalation_due_at = $minutes > 0
                    ? Carbon::now()->addMinutes($minutes)
                    : null;
                break;
            case 'notify':
                $delay = (int) ($step['delay_minutes'] ?? 0);
                $ticket->pending_notification_at = Carbon::now()->addMinutes(max(0, $delay));
                break;
            default:
                break;
        }
    }
}
