<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\Notifications\Events\UserNotificationBroadcast;
use App\Domains\Notifications\Models\UserNotification;
use Throwable;

class CreateUserNotification
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(
        int $userId,
        string $type,
        string $title,
        ?string $body = null,
        array $data = [],
    ): UserNotification {
        $notification = UserNotification::query()->create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data === [] ? null : $data,
        ]);

        $this->broadcast($notification);

        return $notification;
    }

    private function broadcast(UserNotification $notification): void
    {
        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        if ($tenantId === null || $tenantId === '') {
            return;
        }

        try {
            event(new UserNotificationBroadcast($tenantId, (int) $notification->user_id, [
                'data' => [
                    'id' => $notification->id,
                    'type' => $notification->type,
                    'title' => $notification->title,
                    'body' => $notification->body,
                    'data' => $notification->data,
                    'read_at' => null,
                    'created_at' => optional($notification->created_at)?->toIso8601String(),
                ],
            ]));
        } catch (Throwable $e) {
            report($e);
        }
    }
}
