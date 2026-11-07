<?php

namespace App\Domains\Realtime\Support;

use App\Domains\Realtime\Actions\LiveBroadcaster;
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
            LiveTopics::TRAINING_CAMPAIGNS,
        ], $tenantId, $throttled);
    }
}
