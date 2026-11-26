<?php

namespace App\Domains\Realtime\Support;

use App\Models\Tenant;
use App\Models\User;
use App\Support\StaffTenant;

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

        if ($user->isPlatformStaff() && StaffTenant::matches($tenantId)) {
            return true;
        }

        if ($user->tenant_id !== $tenantId) {
            return false;
        }

        $permissions = LiveTopics::permissionsFor($topic);
        if ($permissions === []) {
            return false;
        }

        $previous = getPermissionsTeamId();
        setPermissionsTeamId($tenantId);

        try {
            foreach ($permissions as $permission) {
                if ($user->can($permission)) {
                    return true;
                }
            }

            return false;
        } finally {
            setPermissionsTeamId($previous);
        }
    }
}
