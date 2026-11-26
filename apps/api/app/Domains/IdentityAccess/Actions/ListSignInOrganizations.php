<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Domains\IdentityAccess\Support\SignInEligibility;
use App\Models\TenantMembership;
use App\Models\User;

/**
 * Organizations the signed-in login can work in. Two sources feed the list:
 * - active memberships of this login (no extra password needed to enter them);
 * - other organization logins with the same email, each with its own password (switching needs that password).
 */
class ListSignInOrganizations
{
    public function __construct(private readonly SignInEligibility $eligibility) {}

    /**
     * Organizations entered without another password: the login's own memberships.
     *
     * @param  list<array{tenant_id: string, name: string, requires_password: bool}>  $organizations
     * @return list<string>
     */
    public static function ownTenantIds(array $organizations): array
    {
        $ownTenantIds = [];
        foreach ($organizations as $organization) {
            if (! $organization['requires_password']) {
                $ownTenantIds[] = $organization['tenant_id'];
            }
        }

        return $ownTenantIds;
    }

    /**
     * A login counts as an organization only when it can sign in and its membership there is active.
     */
    public function isUsableOrganizationLogin(User $login): bool
    {
        return $login->tenant_id !== null
            && $this->eligibility->blockReason($login, viaPassword: true) === null
            && $login->belongsToTenant((string) $login->tenant_id);
    }

    /**
     * @return list<array{tenant_id: string, name: string, requires_password: bool}>
     */
    public function handle(User $user, bool $includeSameEmailLogins = true): array
    {
        if ($user->isPlatformStaff()) {
            return [];
        }

        $user->loadMissing('memberships.tenant');

        $organizations = [];
        $tenantIds = [];

        $activeMemberships = $user->memberships
            ->filter(fn (TenantMembership $membership): bool => $membership->isActive())
            ->sortBy('id');

        foreach ($activeMemberships as $membership) {
            $tenantIds[] = $membership->tenant_id;
            $organizations[] = [
                'tenant_id' => $membership->tenant_id,
                'name' => $membership->tenant->name ?? $membership->tenant_id,
                'requires_password' => false,
            ];
        }

        if (! $includeSameEmailLogins) {
            return $organizations;
        }

        $sameEmailLogins = User::query()
            ->withEmail((string) $user->email)
            ->whereNotNull('tenant_id')
            ->whereKeyNot($user->getKey())
            ->with('tenant')
            ->orderBy('tenant_id')
            ->get();

        foreach ($sameEmailLogins as $login) {
            if (in_array($login->tenant_id, $tenantIds, true) || ! $this->isUsableOrganizationLogin($login)) {
                continue;
            }

            $tenantIds[] = (string) $login->tenant_id;
            $organizations[] = [
                'tenant_id' => (string) $login->tenant_id,
                'name' => $login->tenant->name ?? (string) $login->tenant_id,
                'requires_password' => true,
            ];
        }

        return $organizations;
    }
}
