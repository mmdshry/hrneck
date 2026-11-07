<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Ticketing\Models\SdTicket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

class SendPendingNotifications
{
    public function handle(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $count = 0;

        SdTicket::query()
            ->active()
            ->whereNotNull('pending_notification_at')
            ->where('pending_notification_at', '<=', $now)
            ->orderBy('id')
            ->chunkById(50, function ($tickets) use (&$count): void {
                foreach ($tickets as $ticket) {
                    $email = null;
                    if ($ticket->requester_user_id) {
                        $email = User::query()->whereKey($ticket->requester_user_id)->value('email');
                    }
                    if ($email) {
                        Mail::raw(
                            "Ticket {$ticket->number}: {$ticket->summary}",
                            function ($message) use ($email, $ticket): void {
                                $message->to($email)->subject('[Ticketing] '.$ticket->number);
                            },
                        );
                    }
                    $ticket->pending_notification_at = null;
                    $ticket->save();
                    $count++;
                }
            });

        return $count;
    }
}
