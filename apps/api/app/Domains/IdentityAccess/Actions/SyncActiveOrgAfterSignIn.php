<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Models\User;
use App\Support\ActiveOrgTenant;

/**
 * Picks the active organization for a freshly signed-in user: the only organization the login can enter
 * without another password, the one already in session, or none when the user must choose.
 */
class SyncActiveOrgAfterSignIn
{
    public function __construct(private readonly ListSignInOrganizations $organizations) {}

    /**
     * @param  string|null  $preferredTenantId  The organization the sign-in named (the subdomain it was sent from).
     *                                          It becomes active whenever this login can enter it without a password.
     */
    public function handle(User $user, ?string $preferredTenantId = null): void
    {
        if ($user->isPlatformStaff()) {
            ActiveOrgTenant::clear();

            return;
        }

        $organizations = $this->organizations->handle($user);
        $ownTenantIds = ListSignInOrganizations::ownTenantIds($organizations);

        if ($preferredTenantId !== null && in_array($preferredTenantId, $ownTenantIds, true)) {
            ActiveOrgTenant::set($preferredTenantId);

            return;
        }

        if (count($organizations) === 1 && count($ownTenantIds) === 1) {
            ActiveOrgTenant::set($ownTenantIds[0]);

            return;
        }

        $current = ActiveOrgTenant::id();
        if (is_string($current) && $current !== '' && in_array($current, $ownTenantIds, true)) {
            return;
        }

        ActiveOrgTenant::clear();
    }
}
