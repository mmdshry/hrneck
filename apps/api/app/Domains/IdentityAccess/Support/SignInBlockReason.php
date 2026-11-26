<?php

namespace App\Domains\IdentityAccess\Support;

/**
 * Reasons an existing user may not sign in, shared by password and SSO sign-in.
 */
enum SignInBlockReason: string
{
    case Disabled = 'disabled';
    case PasswordSetupRequired = 'password_setup_required';
    case EmailUnverified = 'email_unverified';
}
