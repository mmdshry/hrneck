<?php

namespace App\Domains\IdentityAccess\Support;

class SsoIdTokenValidator
{
    private const CLOCK_SKEW_SECONDS = 60;

    /**
     * Validates the ID token returned by the token endpoint for this sign-in and returns its claims.
     *
     * The signature is not verified. OpenID Connect Core 3.1.3.7 allows skipping it for a token received directly
     * from the token endpoint over TLS, which is the case here: the code exchange is a server-to-server request
     * authenticated with the client secret. Issuer, audience, expiry and nonce are still enforced.
     *
     * @return array<string, mixed>
     *
     * @throws SsoLoginException
     */
    public function validate(string $idToken, SsoProvider $provider, string $clientId, string $expectedNonce): array
    {
        $claims = $this->decodePayload($idToken);

        $issuer = $claims['iss'] ?? null;
        if (! is_string($issuer) || ! $provider->isTrustedIssuer($issuer)) {
            throw $this->invalid('untrusted issuer');
        }

        $audience = $claims['aud'] ?? null;
        $audiences = is_array($audience) ? $audience : [$audience];
        if (! in_array($clientId, $audiences, true)) {
            throw $this->invalid('audience mismatch');
        }

        $expiresAt = $claims['exp'] ?? null;
        if (! is_int($expiresAt) || $expiresAt + self::CLOCK_SKEW_SECONDS < time()) {
            throw $this->invalid('token expired');
        }

        $nonce = $claims['nonce'] ?? null;
        if (! is_string($nonce) || ! hash_equals($expectedNonce, $nonce)) {
            throw $this->invalid('nonce mismatch');
        }

        return $claims;
    }

    /**
     * @return array<string, mixed>
     *
     * @throws SsoLoginException
     */
    private function decodePayload(string $idToken): array
    {
        $segments = explode('.', $idToken);
        if (count($segments) !== 3) {
            throw $this->invalid('malformed token');
        }

        $encoded = strtr($segments[1], '-_', '+/');
        $padded = str_pad($encoded, strlen($encoded) + ((4 - strlen($encoded) % 4) % 4), '=');
        $json = base64_decode($padded, true);
        $claims = is_string($json) ? json_decode($json, true) : null;

        if (! is_array($claims)) {
            throw $this->invalid('unreadable payload');
        }

        return $claims;
    }

    private function invalid(string $reason): SsoLoginException
    {
        return new SsoLoginException(SsoError::ProviderError, 'Invalid ID token: '.$reason.'.');
    }
}
