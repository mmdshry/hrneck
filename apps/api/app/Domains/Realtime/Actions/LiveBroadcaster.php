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

    /**
     * Schedule snapshot after the auth HTTP response so the WS subscription is ready.
     */
    public function scheduleSnapshotAfterResponse(string $channel, string $tenantId, ?string $topic): void
    {
        app()->terminating(function () use ($channel, $tenantId, $topic): void {
            if ($channel === LiveTopics::mspChannel()) {
                $this->snapshotMsp();

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
