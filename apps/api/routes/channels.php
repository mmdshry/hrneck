<?php

use App\Domains\Realtime\Actions\LiveBroadcaster;
use App\Domains\Realtime\Support\LiveChannelGate;
use App\Domains\Realtime\Support\LiveTopics;
use App\Models\User;
use App\Support\StaffTenant;
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
    if ((int) $user->id !== $userId) {
        return false;
    }

    $belongs = (is_string($user->tenant_id) && $user->tenant_id === $tenantId)
        || ($user->isPlatformStaff() && StaffTenant::matches($tenantId));

    if (! $belongs) {
        return false;
    }

    app(LiveBroadcaster::class)->scheduleSnapshotAfterResponse(
        LiveTopics::notificationsChannel($tenantId, $userId),
        $tenantId,
        null,
        $userId,
    );

    return true;
});

Broadcast::channel('org.{tenantId}.learn.{userId}', function (User $user, string $tenantId, int $userId) {
    if ((int) $user->id !== $userId) {
        return false;
    }

    $belongs = (is_string($user->tenant_id) && $user->tenant_id === $tenantId)
        || ($user->isPlatformStaff() && StaffTenant::matches($tenantId));

    if (! $belongs) {
        return false;
    }

    app(LiveBroadcaster::class)->scheduleSnapshotAfterResponse(
        LiveTopics::learnChannel($tenantId, $userId),
        $tenantId,
        null,
        $userId,
    );

    return true;
});

Broadcast::channel('org.{tenantId}.portal.{userId}', function (User $user, string $tenantId, int $userId) {
    if ((int) $user->id !== $userId) {
        return false;
    }

    $belongs = (is_string($user->tenant_id) && $user->tenant_id === $tenantId)
        || ($user->isPlatformStaff() && StaffTenant::matches($tenantId));

    if (! $belongs) {
        return false;
    }

    app(LiveBroadcaster::class)->scheduleSnapshotAfterResponse(
        LiveTopics::portalChannel($tenantId, $userId),
        $tenantId,
        null,
        $userId,
    );

    return true;
});
