<?php

namespace App\Domains\Realtime\Support;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;

final class LiveTopics
{
    public const MSP = 'msp';

    public const METRICS = 'metrics';

    public const REPORTS = 'reports';

    public const REPORTS_EXPORT = 'reports-export';

    public const TRAINING_CAMPAIGNS = 'training-campaigns';

    public const INTEGRATIONS = 'integrations';

    public const SENDING_PROFILES = 'sending-profiles';

    /**
     * @return list<string>
     */
    public static function orgTopics(): array
    {
        return [
            self::METRICS,
            self::REPORTS,
            self::REPORTS_EXPORT,
            self::TRAINING_CAMPAIGNS,
            self::INTEGRATIONS,
            self::SENDING_PROFILES,
        ];
    }

    public static function mspChannel(): string
    {
        return 'msp.live';
    }

    public static function orgChannel(string $tenantId, string $topic): string
    {
        return "org.{$tenantId}.{$topic}";
    }

    public static function permissionFor(string $topic): ?string
    {
        return match ($topic) {
            self::METRICS, self::REPORTS => OrgPermissionCatalog::REPORTS_VIEW,
            self::REPORTS_EXPORT => OrgPermissionCatalog::REPORTS_EXPORT,
            self::TRAINING_CAMPAIGNS => OrgPermissionCatalog::CAMPAIGNS_MANAGE,
            self::INTEGRATIONS, self::SENDING_PROFILES => OrgPermissionCatalog::SETTINGS_MANAGE,
            default => null,
        };
    }
}
