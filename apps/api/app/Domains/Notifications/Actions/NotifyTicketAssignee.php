<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Tenancy\Support\TenantAddress;
use App\Domains\Ticketing\Models\SdTicket;
use App\Models\User;
use App\Support\AppLocale;

class NotifyTicketAssignee
{
    public function __construct(
        private readonly CreateUserNotification $notify,
        private readonly QueueNotificationEmail $queueEmail,
        private readonly TenantAddress $addresses,
    ) {}

    public function handle(SdTicket $ticket, ?int $previousAssigneeId = null): void
    {
        $assigneeId = $ticket->assignee_user_id !== null ? (int) $ticket->assignee_user_id : null;
        if ($assigneeId === null || $assigneeId === $previousAssigneeId) {
            return;
        }

        $link = '/org/ticketing/tickets/'.$ticket->id;
        $user = User::query()->find($assigneeId);
        $locale = AppLocale::normalize(is_string($user?->locale) ? $user->locale : null);

        $this->notify->handle(
            $assigneeId,
            UserNotification::TYPE_TICKET_ASSIGNED,
            __('notifications.ticket_assigned_title', [], $locale),
            $ticket->summary,
            [
                'link' => $link,
                'entity_id' => $ticket->id,
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->number,
            ],
        );

        $email = $user !== null ? trim((string) $user->email) : '';
        if ($email === '') {
            return;
        }

        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        $this->queueEmail->handle(
            $email,
            __('notifications.ticket_assigned_subject', ['number' => $ticket->number], $locale),
            __('notifications.ticket_assigned_body', [
                'number' => $ticket->number,
                'summary' => $ticket->summary,
                'url' => $this->addresses->url($tenantId, $link),
            ], $locale),
            $locale,
            $tenantId,
        );
    }
}
