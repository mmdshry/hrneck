<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Ticketing\Models\SdTicket;
use Illuminate\Support\Carbon;

class ProcessEscalations
{
    public function __construct(private readonly RunProcedure $procedures) {}

    public function handle(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $count = 0;

        SdTicket::query()
            ->active()
            ->whereNotNull('escalation_due_at')
            ->where('escalation_due_at', '<=', $now)
            ->orderBy('id')
            ->chunkById(50, function ($tickets) use (&$count): void {
                foreach ($tickets as $ticket) {
                    $ticket->escalation_level = (int) $ticket->escalation_level + 1;
                    $ticket->escalation_due_at = null;
                    $ticket->save();
                    $this->procedures->handle($ticket, 'on_escalation', $ticket->stage_id ? (int) $ticket->stage_id : null);
                    $count++;
                }
            });

        if ($count > 0) {
            PublishLive::org([
                LiveTopics::TICKETS,
                LiveTopics::TICKETING_REPORTS,
            ], throttled: true);
        }

        return $count;
    }
}
