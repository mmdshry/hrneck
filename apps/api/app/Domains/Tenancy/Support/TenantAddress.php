<?php

namespace App\Domains\Tenancy\Support;

use App\Models\Tenant;

/**
 * Absolute URLs on an organization's own address (for example https://itneck.hrneck.com). Emails and the sign-in
 * finder use these instead of the platform's central domain. The scheme and port follow FRONTEND_URL, and the host
 * is the organization's registered domain. Without a tenant, the platform staff host is used.
 */
class TenantAddress
{
    public function loginUrl(?string $tenantId): string
    {
        return $this->url($tenantId, '/login');
    }

    public function url(?string $tenantId, string $path = '/'): string
    {
        return $this->origin($tenantId).'/'.ltrim($path, '/');
    }

    public function origin(?string $tenantId): string
    {
        $frontend = parse_url((string) config('brand.frontend_url')) ?: [];
        $scheme = (string) ($frontend['scheme'] ?? 'https');
        $port = isset($frontend['port']) ? ':'.$frontend['port'] : '';

        return $scheme.'://'.$this->host($tenantId).$port;
    }

    public function host(?string $tenantId): string
    {
        if ($tenantId === null || $tenantId === '') {
            return strtolower((string) config('brand.staff_host'));
        }

        $registered = Tenant::query()
            ->whereKey($tenantId)
            ->first()
            ?->domains()
            ->orderBy('id')
            ->value('domain');

        if (is_string($registered) && $registered !== '') {
            return strtolower($registered);
        }

        return strtolower($tenantId.'.'.config('brand.tenancy_base_domain'));
    }
}
