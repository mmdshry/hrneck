<?php

namespace App\Domains\Notifications\Support;

use App\Support\OrgTimezone;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class OrgBrandingCache
{
    public static function key(?string $tenantId = null): string
    {
        $tenantId ??= (string) (tenant('id') ?: 'central');

        return 'org:'.$tenantId.':branding:v2';
    }

    /**
     * @return array{display_name: mixed, primary_color: mixed, logo_path: mixed, logo_url: string|null, timezone: string}
     */
    public static function payload(): array
    {
        return Cache::remember(self::key(), 300, function (): array {
            $row = DB::table('organization_settings')->first();
            $hasLogo = $row && filled($row->logo_path ?? null);

            return [
                'display_name' => $row->display_name ?? null,
                'primary_color' => $row->primary_color ?? null,
                'logo_path' => $hasLogo ? $row->logo_path : null,
                'logo_url' => $hasLogo ? '/api/v1/org/branding/logo' : null,
                'timezone' => OrgTimezone::resolve($row->timezone ?? null),
            ];
        });
    }

    public static function forget(?string $tenantId = null): void
    {
        Cache::forget(self::key($tenantId));
    }
}
