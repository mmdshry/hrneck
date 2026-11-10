<?php

namespace App\Domains\Realtime\Support;

use App\Domains\Realtime\Actions\LiveBroadcaster;
use App\Models\User;
use Throwable;

final class PublishLive
{
    public static function msp(): void
    {
        try {
            app(LiveBroadcaster::class)->updatedMsp();
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * @param  list<string>  $topics
     */
    public static function org(array $topics, ?string $tenantId = null, bool $throttled = false): void
    {
        $id = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null);
        if ($id === null || $id === '') {
            return;
        }

        try {
            $broadcaster = app(LiveBroadcaster::class);
            if ($throttled) {
                $broadcaster->updatedOrgTopicsThrottled($id, $topics);

                return;
            }

            $broadcaster->updatedOrgTopics($id, $topics);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public static function metricsBundle(?string $tenantId = null, bool $throttled = false): void
    {
        self::org([
            LiveTopics::METRICS,
            LiveTopics::REPORTS,
            LiveTopics::REPORTS_DETAILED,
            LiveTopics::TRAINING_CAMPAIGNS,
            LiveTopics::TRAINING,
            LiveTopics::CAMPAIGNS,
        ], $tenantId, $throttled);
    }

    public static function learnUser(int $userId, ?string $tenantId = null): void
    {
        $id = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null);
        if ($id === null || $id === '') {
            return;
        }

        try {
            app(LiveBroadcaster::class)->updatedLearnUser($id, $userId);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public static function portalUser(int $userId, ?string $tenantId = null): void
    {
        $id = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null);
        if ($id === null || $id === '') {
            return;
        }

        try {
            app(LiveBroadcaster::class)->updatedPortalUser($id, $userId);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public static function notificationsUser(int $userId, ?string $tenantId = null): void
    {
        $id = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null);
        if ($id === null || $id === '') {
            return;
        }

        try {
            app(LiveBroadcaster::class)->updatedNotificationsUser($id, $userId);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * Fan out learn updates for all org users matching a target email (or all learners when null).
     */
    public static function learnForTargetEmail(?string $email, ?string $tenantId = null): void
    {
        $id = $tenantId ?? (is_string(tenant('id')) ? (string) tenant('id') : null);
        if ($id === null || $id === '' || $email === null || $email === '') {
            return;
        }

        $userIds = User::query()
            ->where('tenant_id', $id)
            ->where('email', $email)
            ->pluck('id');

        foreach ($userIds as $userId) {
            self::learnUser((int) $userId, $id);
        }
    }
}
