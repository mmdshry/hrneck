<?php

namespace App\Domains\IdentityAccess\Actions;

use App\Models\User;
use App\Support\ActiveOrgTenant;

/**
 * Picks the active organization for a freshly signed-in user: the only membership, the one already in session,
 * or none when the user must choose.
 */
class SyncActiveOrgAfterSignIn
{
    public function handle(User $user): void
    {
        if ($user->isPlatformStaff()) {
            ActiveOrgTenant::clear();

            return;
        }

        $user->loadMissing('memberships');
        $active = $user->memberships->filter(fn ($m): bool => $m->isActive())->values();

        if ($active->count() === 1) {
            ActiveOrgTenant::set($active->first()->tenant_id);

            return;
        }

        $current = ActiveOrgTenant::id();
        if (is_string($current) && $current !== '' && $user->belongsToTenant($current)) {
            return;
        }

        ActiveOrgTenant::clear();
    }
}
