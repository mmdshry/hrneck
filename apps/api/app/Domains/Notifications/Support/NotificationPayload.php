<?php

namespace App\Domains\Notifications\Support;

use App\Domains\Notifications\Models\OrgAnnouncement;
use App\Domains\Notifications\Models\UserNotification;
use Illuminate\Support\Collection;

final class NotificationPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function notification(UserNotification $row): array
    {
        return [
            'id' => $row->id,
            'type' => $row->type,
            'title' => $row->title,
            'body' => $row->body,
            'data' => $row->data,
            'read_at' => optional($row->read_at)?->toIso8601String(),
            'created_at' => optional($row->created_at)?->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, UserNotification>  $rows
     * @return list<array<string, mixed>>
     */
    public static function notificationList(Collection $rows): array
    {
        return $rows->map(fn (UserNotification $row) => self::notification($row))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function announcement(OrgAnnouncement $row): array
    {
        return [
            'id' => $row->id,
            'title' => $row->title,
            'body' => $row->body,
            'published_by' => $row->published_by,
            'published_at' => optional($row->published_at)?->toIso8601String(),
            'created_at' => optional($row->created_at)?->toIso8601String(),
        ];
    }
}
