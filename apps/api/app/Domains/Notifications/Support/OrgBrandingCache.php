<?php

namespace App\Domains\Notifications\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class OrgBrandingCache
{
    public static function key(?string $tenantId = null): string
    {
        $tenantId ??= (string) (tenant('id') ?: 'central');

        return 'org:'.$tenantId.':branding:v1';
    }

    /**
     * @return array{display_name: mixed, primary_color: mixed, logo_path: mixed, logo_url: string|null, timezone?: mixed}
     */
    public static function payload(bool $includeTimezone = false): array
    {
        return Cache::remember(self::key(), 300, function () use ($includeTimezone): array {
            $row = DB::table('organization_settings')->first();
            $hasLogo = $row && filled($row->logo_path ?? null);

            $payload = [
                'display_name' => $row->display_name ?? null,
                'primary_color' => $row->primary_color ?? null,
                'logo_path' => $hasLogo ? $row->logo_path : null,
                'logo_url' => $hasLogo ? '/api/v1/org/branding/logo' : null,
            ];

            if ($includeTimezone) {
                $payload['timezone'] = $row->timezone ?? 'UTC';
            }

            return $payload;
        });
    }

    public static function forget(?string $tenantId = null): void
    {
        Cache::forget(self::key($tenantId));
    }
}
