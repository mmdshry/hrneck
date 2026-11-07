<?php

namespace App\Domains\Notifications\Support;

use App\Domains\Notifications\Models\UserNotification;

final class NotificationTypes
{
    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            UserNotification::TYPE_TRAINING_ASSIGNED,
            UserNotification::TYPE_CHECKLIST_ASSIGNED,
            UserNotification::TYPE_TICKET_ASSIGNED,
            UserNotification::TYPE_ANNOUNCEMENT,
        ];
    }
}
