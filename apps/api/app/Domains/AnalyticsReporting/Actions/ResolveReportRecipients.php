<?php

namespace App\Domains\AnalyticsReporting\Actions;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class ResolveReportRecipients
{
    /**
     * Active members of the organization who may view reports, optionally limited to the given users.
     * Permission is read under the tenant's team, the same way the `permission:` route middleware reads it.
     *
     * @param  list<int>|null  $userIds
     * @return Collection<int, User>
     */
    public function handle(string $tenantId, ?array $userIds = null): Collection
    {
        $query = User::query()
            ->inTenant($tenantId)
            ->whereNull('disabled_at')
            ->orderBy('name')
            ->orderBy('id');

        if ($userIds !== null) {
            $query->whereIn('id', $userIds);
        }

        $candidates = $query->get(['id', 'name', 'email']);

        $previousTeam = getPermissionsTeamId();
        setPermissionsTeamId($tenantId);

        try {
            return $candidates
                ->filter(fn (User $user): bool => $user->hasPermissionTo(OrgPermissionCatalog::REPORTS_VIEW))
                ->values();
        } finally {
            setPermissionsTeamId($previousTeam);
        }
    }

    /**
     * Fails validation unless every requested user is an eligible recipient.
     *
     * @param  list<int|string>  $userIds
     * @return Collection<int, User>
     */
    public function requireEligible(string $tenantId, array $userIds): Collection
    {
        $requested = array_values(array_unique(array_map(intval(...), $userIds)));
        $eligible = $this->handle($tenantId, $requested);

        if ($eligible->count() !== count($requested)) {
            throw ValidationException::withMessages([
                'recipient_user_ids' => ['Recipients must be active members of this organization with report access.'],
            ]);
        }

        return $eligible;
    }
}
