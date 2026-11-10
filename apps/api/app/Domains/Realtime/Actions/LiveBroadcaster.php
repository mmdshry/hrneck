<?php

namespace App\Domains\Realtime\Actions;

use App\Domains\Realtime\Events\LiveTopicBroadcast;
use App\Domains\Realtime\Snapshots\LiveSnapshotBuilder;
use App\Domains\Realtime\Support\LiveTopics;
use App\Models\Tenant;
use Illuminate\Support\Facades\Cache;
use Stancl\Tenancy\Tenancy;

class LiveBroadcaster
{
    private const THROTTLE_SECONDS = 1;

    public function __construct(
        private readonly LiveSnapshotBuilder $builder,
        private readonly Tenancy $tenancy,
    ) {}

    public function snapshotMsp(): void
    {
        broadcast(new LiveTopicBroadcast(
            LiveTopics::mspChannel(),
            'snapshot',
            $this->builder->forMsp(),
        ));
    }

    public function updatedMsp(): void
    {
        broadcast(new LiveTopicBroadcast(
            LiveTopics::mspChannel(),
            'updated',
            $this->builder->forMsp(),
        ));
    }

    public function snapshotOrgTopic(string $tenantId, string $topic): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $topic): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::orgChannel($tenantId, $topic),
                'snapshot',
                $this->builder->forOrgTopic($topic),
            ));
        });
    }

    public function updatedOrgTopic(string $tenantId, string $topic): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $topic): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::orgChannel($tenantId, $topic),
                'updated',
                $this->builder->forOrgTopic($topic),
            ));
        });
    }

    /**
     * @param  list<string>  $topics
     */
    public function updatedOrgTopics(string $tenantId, array $topics): void
    {
        foreach ($topics as $topic) {
            $this->updatedOrgTopic($tenantId, $topic);
        }
    }

    /**
     * Coalesce high-frequency metric broadcasts (~1s).
     *
     * @param  list<string>  $topics
     */
    public function updatedOrgTopicsThrottled(string $tenantId, array $topics): void
    {
        foreach ($topics as $topic) {
            $key = "live:throttle:{$tenantId}:{$topic}";
            if (! Cache::add($key, true, self::THROTTLE_SECONDS)) {
                continue;
            }
            $this->updatedOrgTopic($tenantId, $topic);
        }
    }

    public function snapshotLearnUser(string $tenantId, int $userId): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $userId): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::learnChannel($tenantId, $userId),
                'snapshot',
                $this->builder->forLearnUser($userId),
            ));
        });
    }

    public function updatedLearnUser(string $tenantId, int $userId): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $userId): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::learnChannel($tenantId, $userId),
                'updated',
                $this->builder->forLearnUser($userId),
            ));
        });
    }

    public function snapshotPortalUser(string $tenantId, int $userId): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $userId): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::portalChannel($tenantId, $userId),
                'snapshot',
                $this->builder->forPortalUser($userId),
            ));
        });
    }

    public function updatedPortalUser(string $tenantId, int $userId): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $userId): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::portalChannel($tenantId, $userId),
                'updated',
                $this->builder->forPortalUser($userId),
            ));
        });
    }

    public function snapshotNotificationsUser(string $tenantId, int $userId): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $userId): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::notificationsChannel($tenantId, $userId),
                'snapshot',
                $this->builder->forNotificationsUser($userId),
            ));
        });
    }

    public function updatedNotificationsUser(string $tenantId, int $userId): void
    {
        $this->withTenant($tenantId, function () use ($tenantId, $userId): void {
            broadcast(new LiveTopicBroadcast(
                LiveTopics::notificationsChannel($tenantId, $userId),
                'updated',
                $this->builder->forNotificationsUser($userId),
            ));
        });
    }

    /**
     * Schedule snapshot after the auth HTTP response so the WS subscription is ready.
     */
    public function scheduleSnapshotAfterResponse(string $channel, string $tenantId, ?string $topic, ?int $userId = null): void
    {
        app()->terminating(function () use ($channel, $tenantId, $topic, $userId): void {
            if ($channel === LiveTopics::mspChannel()) {
                $this->snapshotMsp();

                return;
            }

            if ($userId !== null && str_ends_with($channel, '.learn.'.$userId)) {
                $this->snapshotLearnUser($tenantId, $userId);

                return;
            }

            if ($userId !== null && str_ends_with($channel, '.portal.'.$userId)) {
                $this->snapshotPortalUser($tenantId, $userId);

                return;
            }

            if ($userId !== null && str_ends_with($channel, '.notifications.'.$userId)) {
                $this->snapshotNotificationsUser($tenantId, $userId);

                return;
            }

            if ($topic !== null) {
                $this->snapshotOrgTopic($tenantId, $topic);
            }
        });
    }

    /**
     * @param  callable(): void  $callback
     */
    private function withTenant(string $tenantId, callable $callback): void
    {
        $tenant = Tenant::query()->find($tenantId);
        if (! $tenant) {
            return;
        }

        $previous = $this->tenancy->initialized ? $this->tenancy->tenant : null;
        $this->tenancy->initialize($tenant);

        try {
            $callback();
        } finally {
            if ($previous) {
                $this->tenancy->initialize($previous);
            } else {
                $this->tenancy->end();
            }
        }
    }
}
