<?php

namespace App\Domains\IdentityAccess\Support;

/**
 * External identity providers accepted for SSO sign-in.
 */
enum SsoProvider: string
{
    case Google = 'google';
    case Microsoft = 'microsoft';

    /**
     * Socialite driver name. Microsoft is served by socialiteproviders/microsoft-azure, registered as "azure".
     */
    public function driverName(): string
    {
        return match ($this) {
            self::Google => 'google',
            self::Microsoft => 'azure',
        };
    }

    /**
     * Whether a client id is configured in services.php (from the .env values). Unconfigured providers are hidden
     * in the UI and refused at the redirect endpoint.
     */
    public function isConfigured(): bool
    {
        $clientId = config('services.'.$this->driverName().'.client_id');

        return is_string($clientId) && trim($clientId) !== '';
    }

    /**
     * OAuth scopes requested at the authorize endpoint. "openid" is required so an ID token is issued.
     *
     * @return list<string>
     */
    public function scopes(): array
    {
        return match ($this) {
            self::Google => ['openid', 'profile', 'email'],
            self::Microsoft => ['openid', 'profile', 'email', 'User.Read'],
        };
    }

    /**
     * Whether the "iss" claim of an ID token belongs to this provider.
     * Microsoft issues per-directory issuers (the tenant id is in the path), including the personal-account tenant.
     */
    public function isTrustedIssuer(string $issuer): bool
    {
        return match ($this) {
            self::Google => in_array($issuer, ['https://accounts.google.com', 'accounts.google.com'], true),
            self::Microsoft => preg_match('#^https://login\.microsoftonline\.com/[0-9a-fA-F-]{36}/v2\.0$#', $issuer) === 1,
        };
    }

    /**
     * Whether the email asserted by this provider may be used to link an existing account.
     *
     * Google asserts email_verified in its ID token. Microsoft exposes no such claim, so the account's
     * sign-in email (mail or userPrincipalName) is trusted. Microsoft verifies ownership of that address
     * when the account is created, and Entra only allows verified domains.
     *
     * @param  array<string, mixed>  $idTokenClaims
     */
    public function emailIsVerified(array $idTokenClaims): bool
    {
        return match ($this) {
            self::Google => ($idTokenClaims['email_verified'] ?? false) === true,
            self::Microsoft => true,
        };
    }
}
