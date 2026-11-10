<?php

namespace App\Domains\Ticketing\Actions;

use App\Domains\Realtime\Support\LiveTopics;
use App\Domains\Realtime\Support\PublishLive;
use App\Domains\Ticketing\Models\SdEmailInboundLog;
use App\Domains\Ticketing\Models\SdEmailReader;
use App\Domains\Ticketing\Models\SdTicket;
use App\Domains\Ticketing\Models\SdTicketNote;
use App\Models\User;

class ProcessInboundEmail
{
    public function __construct(private readonly CreateTicket $createTicket) {}

    /**
     * Process a parsed email payload (used by IMAP poller and tests).
     *
     * @param  array{from: string, subject: string, body: string, message_id?: string}  $email
     */
    public function handle(SdEmailReader $reader, array $email): SdTicket
    {
        $from = strtolower(trim((string) ($email['from'] ?? '')));
        $subject = (string) ($email['subject'] ?? 'N/A');
        $body = (string) ($email['body'] ?? '');
        $messageId = $email['message_id'] ?? null;

        $blacklist = collect($reader->blacklist ?? [])->map(fn ($v) => strtolower((string) $v));
        if ($from !== '' && $blacklist->contains($from)) {
            SdEmailInboundLog::query()->create([
                'email_reader_id' => $reader->id,
                'message_id' => $messageId,
                'from_email' => $from,
                'subject' => $subject,
                'status' => 'blacklisted',
                'detail' => 'Sender blacklisted',
            ]);
            throw new \RuntimeException('Sender blacklisted');
        }

        if (preg_match('/\b([A-Z]{2,3}-\d{6})\b/i', $subject.' '.$body, $m)) {
            $ticket = SdTicket::query()->where('number', strtoupper($m[1]))->first();
            if ($ticket) {
                SdTicketNote::query()->create([
                    'ticket_id' => $ticket->id,
                    'body' => $body !== '' ? $body : '(empty email body)',
                    'is_public' => true,
                    'author_user_id' => null,
                ]);
                SdEmailInboundLog::query()->create([
                    'email_reader_id' => $reader->id,
                    'message_id' => $messageId,
                    'from_email' => $from,
                    'subject' => $subject,
                    'ticket_id' => $ticket->id,
                    'status' => 'note_added',
                ]);

                PublishLive::org([LiveTopics::TICKETS], throttled: true);
                if ($ticket->requester_user_id) {
                    PublishLive::portalUser((int) $ticket->requester_user_id);
                }

                return $ticket->fresh(['notes']) ?? $ticket;
            }
        }

        $user = null;
        if ($from !== '') {
            $userQuery = User::query()->whereRaw('LOWER(email) = ?', [$from]);
            $tenantId = tenant('id');
            if (is_string($tenantId) && $tenantId !== '') {
                $userQuery->where('tenant_id', $tenantId);
            }
            $user = $userQuery->first();
        }
        $defaults = $reader->defaults ?? [];

        $ticket = $this->createTicket->handle([
            'desk_id' => $reader->desk_id,
            'summary' => $subject !== '' ? $subject : 'N/A',
            'description' => $body !== '' ? $body : null,
            'priority_id' => $defaults['priority_id'] ?? null,
            'category_id' => $defaults['category_id'] ?? null,
            'requester_user_id' => $user?->id,
            'assignee_pool' => $defaults['assignee_pool'] ?? null,
        ], $user?->id);

        SdEmailInboundLog::query()->create([
            'email_reader_id' => $reader->id,
            'message_id' => $messageId,
            'from_email' => $from,
            'subject' => $subject,
            'ticket_id' => $ticket->id,
            'status' => 'created',
        ]);

        return $ticket;
    }
}
