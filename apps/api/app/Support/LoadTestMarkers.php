<?php

namespace App\Support;

final class LoadTestMarkers
{
    public const TENANT_PREFIX = 'loadtest-org-';

    public const EXTERNAL_ID_PREFIX = 'loadtest:';

    public const EMAIL_DOMAIN = 'loadtest.example';

    public const GROUP_PREFIX = 'loadtest-';

    public static function tenantId(int $index): string
    {
        return self::TENANT_PREFIX.str_pad((string) $index, 3, '0', STR_PAD_LEFT);
    }

    public static function isLoadTestTenantId(string $id): bool
    {
        return str_starts_with($id, self::TENANT_PREFIX);
    }

    public static function databaseName(string $tenantId): string
    {
        return config('tenancy.database.prefix').$tenantId;
    }

    public static function targetExternalId(string $tenantKey, int $n): string
    {
        return self::EXTERNAL_ID_PREFIX.$tenantKey.':'.$n;
    }

    public static function targetEmail(string $localPart): string
    {
        return $localPart.'@'.self::EMAIL_DOMAIN;
    }

    public static function groupExternalId(string $department): string
    {
        return self::GROUP_PREFIX.'dept-'.strtolower(str_replace(' ', '-', $department));
    }
}
