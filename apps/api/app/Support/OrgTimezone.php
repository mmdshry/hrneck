<?php

namespace App\Support;

use DateTimeZone;
use Illuminate\Support\Facades\DB;

/**
 * The tenant (organization) timezone. Recorded times are stored in UTC and
 * presented in this zone. Individual people do not have their own timezone.
 */
final class OrgTimezone
{
    public const DEFAULT = 'UTC';

    public static function current(): string
    {
        return self::resolve(DB::table('organization_settings')->value('timezone'));
    }

    public static function resolve(mixed $stored): string
    {
        if (! is_string($stored) || trim($stored) === '') {
            return self::DEFAULT;
        }

        try {
            return (new DateTimeZone(trim($stored)))->getName();
        } catch (\Exception) {
            return self::DEFAULT;
        }
    }
}
