<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\Notifications\Models\OrgAnnouncement;
use App\Domains\Notifications\Models\UserNotification;
use App\Models\User;
use Illuminate\Support\Carbon;

class FanOutAnnouncement
{
    public function __construct(private readonly CreateUserNotification $notify) {}

    public function handle(string $title, string $body, ?int $publishedBy = null): OrgAnnouncement
    {
        $announcement = OrgAnnouncement::query()->create([
            'title' => $title,
            'body' => $body,
            'published_by' => $publishedBy,
            'published_at' => Carbon::now(),
        ]);

        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        if ($tenantId === null || $tenantId === '') {
            return $announcement;
        }

        $userIds = User::query()
            ->where('tenant_id', $tenantId)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        foreach ($userIds as $userId) {
            $this->notify->handle(
                $userId,
                UserNotification::TYPE_ANNOUNCEMENT,
                $title,
                $body,
                [
                    'link' => '/org',
                    'entity_id' => $announcement->id,
                    'announcement_id' => $announcement->id,
                ],
            );
        }

        return $announcement;
    }
}
