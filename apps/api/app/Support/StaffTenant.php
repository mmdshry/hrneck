<?php

namespace App\Support;

use App\Models\Tenant;

final class StaffTenant
{
    public const SESSION_KEY = 'staff_tenant_id';

    public static function id(): ?string
    {
        if (! app()->bound('request') || ! request()->hasSession()) {
            return null;
        }

        $id = request()->session()->get(self::SESSION_KEY);

        return is_string($id) && $id !== '' ? $id : null;
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
