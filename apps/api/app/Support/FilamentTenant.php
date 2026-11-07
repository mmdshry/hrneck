<?php

namespace App\Support;

use App\Models\Tenant;

final class FilamentTenant
{
    public const SESSION_KEY = 'filament_tenant_id';

    public static function id(): ?string
    {
        $id = session(self::SESSION_KEY);

        return is_string($id) && $id !== '' ? $id : null;
    }

    public static function set(?string $tenantId): void
    {
        if ($tenantId === null || $tenantId === '') {
            session()->forget(self::SESSION_KEY);

            return;
        }

        session([self::SESSION_KEY => $tenantId]);
    }

    public static function tenant(): ?Tenant
    {
        $id = self::id();
        if ($id === null) {
            return null;
        }

        return Tenant::query()->find($id);
    }

    public static function has(): bool
    {
        return self::id() !== null && self::tenant() !== null;
    }

    /** @return array<string, string> */
    public static function options(): array
    {
        return Tenant::query()
            ->orderBy('name')
            ->get()
            ->mapWithKeys(fn (Tenant $t) => [$t->id => $t->name.' ('.$t->id.')'])
            ->all();
    }
}
