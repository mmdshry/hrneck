<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Notifications\Actions\NotifyTicketAssignee;
use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Ticketing\Models\SdDesk;
use App\Domains\Ticketing\Models\SdStage;
use App\Domains\Ticketing\Models\SdStatus;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdUserPreference;
use App\Domains\Ticketing\Support\TicketNumberAllocator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CreateTicket
{
    public function __construct(
        private readonly TicketNumberAllocator $numbers,
        private readonly RunProcedure $procedures,
        private readonly ApplySlaGoals $sla,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?int $actorUserId = null): SdTicket
    {
        return DB::transaction(function () use ($data, $actorUserId): SdTicket {
            /** @var SdDesk $desk */
            $desk = SdDesk::query()->where('is_active', true)->findOrFail((int) $data['desk_id']);

            $stage = isset($data['stage_id'])
                ? SdStage::query()->where('desk_id', $desk->id)->find((int) $data['stage_id'])
                : $desk->stages()->orderBy('sequence')->first();

            $status = isset($data['status_id'])
                ? SdStatus::query()->where('desk_id', $desk->id)->find((int) $data['status_id'])
                : $desk->statuses()->orderBy('sort_order')->first();

            $ticket = new SdTicket([
                'desk_id' => $desk->id,
                'number' => $this->numbers->next($desk),
                'summary' => (string) $data['summary'],
                'description' => $data['description'] ?? null,
                'stage_id' => $stage?->id,
                'status_id' => $status?->id,
                'priority_id' => $data['priority_id'] ?? $desk->priorities()->where('slug', 'medium')->value('id'),
                'severity_id' => $data['severity_id'] ?? null,
                'category_id' => $data['category_id'] ?? null,
                'requester_user_id' => $data['requester_user_id'] ?? $actorUserId,
                'requester_target_id' => $data['requester_target_id'] ?? null,
                'assignee_user_id' => $data['assignee_user_id'] ?? null,
                'assignee_pool' => $data['assignee_pool'] ?? null,
                'custom_fields' => $data['custom_fields'] ?? null,
                'is_unread' => true,
                'created_by' => $actorUserId,
                'updated_by' => $actorUserId,
            ]);

            if ($stage?->default_escalation_minutes) {
                $ticket->escalation_due_at = Carbon::now()->addMinutes((int) $stage->default_escalation_minutes);
            }

            $this->sla->onCreate($ticket);
            $ticket->save();

            $delay = 0;
            if ($actorUserId) {
                $delay = (int) (SdUserPreference::query()->where('user_id', $actorUserId)->value('email_send_delay_minutes') ?? 0);
            }
            if ($delay > 0) {
                $ticket->pending_notification_at = Carbon::now()->addMinutes($delay);
                $ticket->save();
            }

            $this->procedures->handle($ticket, 'on_create');
            if ($ticket->stage_id) {
                $this->procedures->handle($ticket->fresh() ?? $ticket, 'on_stage_enter', (int) $ticket->stage_id);
            }

            $fresh = $ticket->fresh(['desk', 'stage', 'status', 'priority', 'severity', 'category', 'notes', 'tasks', 'links'])
                ?? $ticket;
            app(NotifyTicketAssignee::class)->handle($fresh);

            PublishLive::org([
                LiveTopics::TICKETS,
                LiveTopics::TICKETING_REPORTS,
                LiveTopics::REPORTS_DETAILED,
            ], throttled: true);

            if ($fresh->requester_user_id) {
                PublishLive::portalUser((int) $fresh->requester_user_id);
            }

            return $fresh;
        });
    }
}
