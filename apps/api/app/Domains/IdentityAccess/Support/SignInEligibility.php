<?php

namespace App\Domains\IdentityAccess\Support;

use App\Models\User;

/**
 * Decides whether an existing user may start a session.
 *
 * Password sign-in enforces every rule. SSO sign-in only enforces account state: the identity provider has
 * already authenticated the user, and an SSO-linked email is verified when the link is created.
 */
class SignInEligibility
{
    public function blockReason(User $user, bool $viaPassword): ?SignInBlockReason
    {
        if ($user->disabled_at !== null) {
            return SignInBlockReason::Disabled;
        }

        if (! $viaPassword) {
            return null;
        }

        if ($user->must_set_password) {
            return SignInBlockReason::PasswordSetupRequired;
        }

        if ($user->email_verified_at === null) {
            return SignInBlockReason::EmailUnverified;
        }

        return null;
    }
}
