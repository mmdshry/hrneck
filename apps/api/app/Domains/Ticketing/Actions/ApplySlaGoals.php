<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdPriority;
use App\Domains\Ticketing\Models\SdSlaPolicy;
use App\Domains\Ticketing\Models\SdTicket;
use Illuminate\Support\Carbon;

class ApplySlaGoals
{
    public function onCreate(SdTicket $ticket): void
    {
        $policy = SdSlaPolicy::query()
            ->where('desk_id', $ticket->desk_id)
            ->where('is_default', true)
            ->first();

        if (! $policy || ! $ticket->priority_id) {
            return;
        }

        $priority = SdPriority::query()->find($ticket->priority_id);
        if (! $priority) {
            return;
        }

        $goal = collect($policy->goals ?? [])->firstWhere('priority_slug', $priority->slug);
        if (! is_array($goal)) {
            return;
        }

        $now = Carbon::now();
        $response = (int) ($goal['response_minutes'] ?? 0);
        $resolve = (int) ($goal['resolve_minutes'] ?? 0);

        $ticket->sla_response_due_at = $response > 0 ? $now->copy()->addMinutes($response) : null;
        $ticket->sla_resolve_due_at = $resolve > 0 ? $now->copy()->addMinutes($resolve) : null;
    }

    public function evaluateBreaches(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $count = 0;

        SdTicket::query()
            ->active()
            ->where(function ($q) use ($now): void {
                $q->where(function ($q2) use ($now): void {
                    $q2->whereNull('first_responded_at')
                        ->where('sla_response_breached', false)
                        ->whereNotNull('sla_response_due_at')
                        ->where('sla_response_due_at', '<', $now);
                })->orWhere(function ($q2) use ($now): void {
                    $q2->whereNull('resolved_at')
                        ->where('sla_resolve_breached', false)
                        ->whereNotNull('sla_resolve_due_at')
                        ->where('sla_resolve_due_at', '<', $now);
                });
            })
            ->orderBy('id')
            ->chunkById(100, function ($tickets) use ($now, &$count): void {
                foreach ($tickets as $ticket) {
                    $changed = false;
                    if (! $ticket->first_responded_at
                        && $ticket->sla_response_due_at
                        && $ticket->sla_response_due_at->lt($now)
                        && ! $ticket->sla_response_breached) {
                        $ticket->sla_response_breached = true;
                        $changed = true;
                    }
                    if (! $ticket->resolved_at
                        && $ticket->sla_resolve_due_at
                        && $ticket->sla_resolve_due_at->lt($now)
                        && ! $ticket->sla_resolve_breached) {
                        $ticket->sla_resolve_breached = true;
                        $changed = true;
                    }
                    if ($changed) {
                        $ticket->save();
                        $count++;
                    }
                }
            });

        return $count;
    }
}
