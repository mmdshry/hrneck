<?php

namespace App\Domains\IdentityAccess\Support;

/**
 * Validates the browser origin an SSO sign-in returns to.
 *
 * Only the platform's own domain and its subdomains (tenant hosts) are accepted, so the flow cannot be used as an
 * open redirect.
 */
class SsoReturnOrigin
{
    /**
     * @return string|null The origin as scheme://host[:port], or null when it is not an allowed platform host.
     */
    public function normalize(string $url): ?string
    {
        $parts = parse_url($url);
        if (! is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return null;
        }

        $baseDomain = strtolower((string) config('brand.tenancy_base_domain'));
        if ($baseDomain === '' || ($host !== $baseDomain && ! str_ends_with($host, '.'.$baseDomain))) {
            return null;
        }

        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        return $scheme.'://'.$host.$port;
    }
}
