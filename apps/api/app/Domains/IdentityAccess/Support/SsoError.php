<?php

namespace App\Domains\IdentityAccess\Support;

/**
 * Error codes returned to the web app as the `sso_error` query parameter.
 * The web app maps each code to a translated message; keep the two lists in sync.
 */
enum SsoError: string
{
    case Cancelled = 'cancelled';
    case InvalidRequest = 'invalid_request';
    case InvalidState = 'invalid_state';
    case ProviderError = 'provider_error';
    case NotLinked = 'not_linked';
    case AccountDisabled = 'account_disabled';
    case HandoffInvalid = 'handoff_invalid';
    case ProviderNotConfigured = 'provider_not_configured';
}
