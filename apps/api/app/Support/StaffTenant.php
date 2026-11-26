<?php

namespace App\Support;

use App\Models\Tenant;
use Illuminate\Http\Request;

final class StaffTenant
{
    public const SESSION_KEY = 'staff_tenant_id';

    /**
     * Request attribute that marks one request as acting in a tenant without a session. Assistant tool
     * calls come from Copilot Studio, so they carry no session. The tool middleware sets this attribute
     * for conversations started by platform staff acting in that tenant.
     */
    public const REQUEST_ATTRIBUTE = 'staff_tenant_override';

    public static function id(): ?string
    {
        if (! app()->bound('request')) {
            return null;
        }

        $override = request()->attributes->get(self::REQUEST_ATTRIBUTE);
        if (is_string($override) && $override !== '') {
            return $override;
        }

        if (! request()->hasSession()) {
            return null;
        }

        $id = request()->session()->get(self::SESSION_KEY);

        return is_string($id) && $id !== '' ? $id : null;
    }

    public static function markRequest(Request $request, string $tenantId): void
    {
        $request->attributes->set(self::REQUEST_ATTRIBUTE, $tenantId);
    }

    public static function set(?string $tenantId): void
    {
        if (! app()->bound('request') || ! request()->hasSession()) {
            return;
        }

        if ($tenantId === null || $tenantId === '') {
            request()->session()->forget(self::SESSION_KEY);

            return;
        }

        request()->session()->put(self::SESSION_KEY, $tenantId);
    }

    public static function clear(): void
    {
        self::set(null);
    }

    public static function tenant(): ?Tenant
    {
        $id = self::id();
        if ($id === null) {
            return null;
        }

        return Tenant::query()->find($id);
    }

    public static function matches(?string $tenantId): bool
    {
        $active = self::id();

        return $active !== null && $tenantId !== null && $active === $tenantId;
    }
}
