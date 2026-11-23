<?php

namespace App\Domains\Notifications\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Domains\Notifications\Models\OrgAnnouncement;
use App\Domains\Notifications\Models\UserNotification;
use App\Models\User;
use App\Support\AppLocale;
use Illuminate\Support\Carbon;

class FanOutAnnouncement
{
    public function __construct(
        private readonly CreateUserNotification $notify,
        private readonly QueueNotificationEmail $queueEmail,
    ) {}

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

        $users = User::query()
            ->inTenant($tenantId)
            ->whereNull('disabled_at')
            ->get(['id', 'tenant_id', 'email', 'locale']);

        $frontend = rtrim((string) config('brand.frontend_url', config('app.url')), '/');

        foreach ($users as $user) {
            $link = $this->announcementLinkFor($user, $tenantId);
            $locale = AppLocale::normalize(is_string($user->locale) ? $user->locale : null);
            $this->notify->handle(
                (int) $user->id,
                UserNotification::TYPE_ANNOUNCEMENT,
                $title,
                $body,
                [
                    'link' => $link,
                    'entity_id' => $announcement->id,
                    'announcement_id' => $announcement->id,
                ],
            );

            $email = trim((string) $user->email);
            if ($email === '') {
                continue;
            }

            $this->queueEmail->handle(
                $email,
                $title,
                $body.__('notifications.announcement_open', ['url' => $frontend.$link], $locale),
                $locale,
            );
        }

        return $announcement;
    }

    private function announcementLinkFor(User $user, string $tenantId): string
    {
        setPermissionsTeamId($tenantId);
        try {
            $roles = $user->getRoleNames()->values()->all();
            $isLearnerOnly = $roles === [OrgPermissionCatalog::LEARNER]
                || ($roles === [] && $user->can(OrgPermissionCatalog::TICKETING_PORTAL));
            $hasOrgAccess = false;
            foreach ($roles as $role) {
                if ($role !== OrgPermissionCatalog::LEARNER) {
                    $hasOrgAccess = true;
                    break;
                }
            }
            if ($hasOrgAccess) {
                return '/org';
            }
            if ($isLearnerOnly || $user->can(OrgPermissionCatalog::TICKETING_PORTAL)) {
                return '/portal';
            }
        } finally {
            setPermissionsTeamId(null);
        }

        return '/portal';
    }
}
