<?php

use App\Domains\Realtime\Actions\LiveBroadcaster;
use App\Domains\Realtime\Support\LiveChannelGate;
use App\Domains\Realtime\Support\LiveTopics;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('msp.live', function (User $user) {
    if (! app(LiveChannelGate::class)->allowsMsp($user)) {
        return false;
    }

    app(LiveBroadcaster::class)->scheduleSnapshotAfterResponse(
        LiveTopics::mspChannel(),
        '',
        null,
    );

    return true;
});

Broadcast::channel('org.{tenantId}.{topic}', function (User $user, string $tenantId, string $topic) {
    if (! app(LiveChannelGate::class)->allowsOrgTopic($user, $tenantId, $topic)) {
        return false;
    }

    app(LiveBroadcaster::class)->scheduleSnapshotAfterResponse(
        LiveTopics::orgChannel($tenantId, $topic),
        $tenantId,
        $topic,
    );

    return true;
});

Broadcast::channel('org.{tenantId}.notifications.{userId}', function (User $user, string $tenantId, int $userId) {
    return (int) $user->id === $userId
        && is_string($user->tenant_id)
        && $user->tenant_id === $tenantId;
});
