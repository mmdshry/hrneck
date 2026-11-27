<?php

namespace App\Domains\IdentityAccess\Support;

/**
 * Validates the browser origin an SSO sign-in returns to.
 *
 * Only an organization's own address ({slug}.{base}) is accepted. The main domain, the platform staff host and other
 * reserved labels are refused, so SSO cannot be used to sign in from the central site, and the flow cannot be used as
 * an open redirect.
 */
class SsoReturnOrigin
{
    /** Labels under the base domain that are platform hosts, never an organization. */
    private const RESERVED_LABELS = ['app', 'admin', 'api', 'mail', 'www'];

    /**
     * @return string|null The origin as scheme://host[:port], or null when it is not an organization host.
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

        if ($this->organizationSlug($host) === null) {
            return null;
        }

        $port = isset($parts['port']) ? ':'.$parts['port'] : '';

        return $scheme.'://'.$host.$port;
    }

    /**
     * The organization a tenant host names (its single label before the base domain), or null when the origin is not
     * an organization host. The result is only a hint: the sign-in still needs a login in that organization.
     */
    public function tenantFor(string $origin): ?string
    {
        $host = strtolower((string) parse_url($origin, PHP_URL_HOST));

        return $this->organizationSlug($host);
    }

    private function organizationSlug(string $host): ?string
    {
        $baseDomain = strtolower((string) config('brand.tenancy_base_domain'));
        $suffix = '.'.$baseDomain;

        if ($baseDomain === '' || ! str_ends_with($host, $suffix)) {
            return null;
        }

        $label = substr($host, 0, -strlen($suffix));
        if ($label === '' || str_contains($label, '.') || in_array($label, self::RESERVED_LABELS, true)) {
            return null;
        }

        return $label;
    }
}
