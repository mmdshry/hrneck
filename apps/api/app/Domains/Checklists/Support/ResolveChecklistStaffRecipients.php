<?php

namespace App\Domains\Checklists\Support;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\User;

final class ResolveChecklistStaffRecipients
{
    /** Permissions that let a member open checklist instances. */
    private const PERMISSIONS = [
        OrgPermissionCatalog::CHECKLISTS_VIEW,
        OrgPermissionCatalog::CHECKLISTS_FILL,
        OrgPermissionCatalog::CHECKLISTS_MANAGE,
    ];

    /**
     * Active organization members who may open checklist instances, plus the user who made the assignment.
     * Permission is read under the tenant's team, the same way the `permission:` route middleware reads it.
     *
     * @return list<int>
     */
    public function handle(?int $actorId): array
    {
        $tenantId = is_string(tenant('id')) ? (string) tenant('id') : null;
        if ($tenantId === null || $tenantId === '') {
            return [];
        }

        $candidates = User::query()
            ->inTenant($tenantId)
            ->whereNull('disabled_at')
            ->get(['id']);

        $previousTeam = getPermissionsTeamId();
        setPermissionsTeamId($tenantId);

        try {
            $staffIds = $candidates
                ->filter(fn (User $user): bool => $user->hasAnyPermission(self::PERMISSIONS))
                ->map(fn (User $user): int => (int) $user->id)
                ->values()
                ->all();
        } finally {
            setPermissionsTeamId($previousTeam);
        }

        $recipientIds = $actorId === null ? $staffIds : [...$staffIds, $actorId];

        return array_values(array_unique($recipientIds));
    }
}
