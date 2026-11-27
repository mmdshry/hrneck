<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Notifications\Mails\BrandedNotificationMail;
use App\Domains\Tenancy\Support\TenantAddress;
use App\Domains\Ticketing\Models\SdTicket;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

class SendPendingNotifications
{
    public function __construct(private readonly TenantAddress $addresses) {}

    public function handle(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $count = 0;
        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        $loginUrl = $tenantId === null ? null : $this->addresses->loginUrl($tenantId);

        SdTicket::query()
            ->active()
            ->whereNotNull('pending_notification_at')
            ->where('pending_notification_at', '<=', $now)
            ->orderBy('id')
            ->chunkById(50, function ($tickets) use (&$count, $loginUrl): void {
                foreach ($tickets as $ticket) {
                    $email = null;
                    if ($ticket->requester_user_id) {
                        $email = User::query()->whereKey($ticket->requester_user_id)->value('email');
                    }
                    if ($email) {
                        Mail::to($email)->send(new BrandedNotificationMail(
                            subjectLine: '[Ticketing] '.$ticket->number,
                            title: 'Ticket '.$ticket->number,
                            lines: [(string) $ticket->summary],
                            loginUrl: $loginUrl,
                        ));
                    }
                    $ticket->pending_notification_at = null;
                    $ticket->save();
                    $count++;
                }
            });

        return $count;
    }
}
