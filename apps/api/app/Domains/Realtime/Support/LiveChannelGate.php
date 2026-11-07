<?php

namespace App\Domains\Realtime\Support;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\Tenant;
use App\Models\User;

final class LiveChannelGate
{
    public function allowsMsp(User $user): bool
    {
        return $user->isPlatformStaff();
    }

    public function allowsOrgTopic(User $user, string $tenantId, string $topic): bool
    {
        if (! in_array($topic, LiveTopics::orgTopics(), true)) {
            return false;
        }

        if (! Tenant::query()->whereKey($tenantId)->exists()) {
            return false;
        }

        if ($user->tenant_id !== $tenantId) {
            return false;
        }

        $permission = LiveTopics::permissionFor($topic);
        if ($permission === null) {
            return false;
        }

        $previous = getPermissionsTeamId();
        setPermissionsTeamId($tenantId);

        try {
            return $user->can($permission) || $user->hasRole(OrgPermissionCatalog::ORG_ADMIN);
        } finally {
            setPermissionsTeamId($previous);
        }
    }
}
