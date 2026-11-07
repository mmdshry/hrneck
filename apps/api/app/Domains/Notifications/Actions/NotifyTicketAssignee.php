<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\Notifications\Models\UserNotification;
use App\Domains\Ticketing\Models\SdTicket;

class NotifyTicketAssignee
{
    public function __construct(private readonly CreateUserNotification $notify) {}

    public function handle(SdTicket $ticket, ?int $previousAssigneeId = null): void
    {
        $assigneeId = $ticket->assignee_user_id !== null ? (int) $ticket->assignee_user_id : null;
        if ($assigneeId === null || $assigneeId === $previousAssigneeId) {
            return;
        }

        $this->notify->handle(
            $assigneeId,
            UserNotification::TYPE_TICKET_ASSIGNED,
            'Ticket assigned to you',
            $ticket->summary,
            [
                'link' => '/org/ticketing/tickets/'.$ticket->id,
                'entity_id' => $ticket->id,
                'ticket_id' => $ticket->id,
                'ticket_number' => $ticket->number,
            ],
        );
    }
}
