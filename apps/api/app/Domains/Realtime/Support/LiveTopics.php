<?php

namespace App\Domains\Realtime\Support;

use App\Domains\IdentityAccess\Support\OrgPermissionCatalog;

final class LiveTopics
{
    public const MSP = 'msp';

    public const METRICS = 'metrics';

    public const REPORTS = 'reports';

    public const REPORTS_EXPORT = 'reports-export';

    public const REPORTS_DETAILED = 'reports-detailed';

    public const TRAINING_CAMPAIGNS = 'training-campaigns';

    public const TRAINING = 'training';

    public const CAMPAIGNS = 'campaigns';

    public const INTEGRATIONS = 'integrations';

    public const SENDING_PROFILES = 'sending-profiles';

    public const USERS = 'users';

    public const ROLES = 'roles';

    public const TARGETS = 'targets';

    public const DEPARTMENTS = 'departments';

    public const GROUPS = 'groups';

    public const CHECKLISTS = 'checklists';

    public const CHECKLIST_INSTANCES = 'checklist-instances';

    public const TICKETS = 'tickets';

    public const DESKS = 'desks';

    public const KB = 'kb';

    public const EMAIL_READERS = 'email-readers';

    public const TICKETING_REPORTS = 'ticketing-reports';

    public const ANNOUNCEMENTS = 'announcements';

    public const BRANDING = 'branding';

    /**
     * @return list<string>
     */
    public static function orgTopics(): array
    {
        return [
            self::METRICS,
            self::REPORTS,
            self::REPORTS_EXPORT,
            self::REPORTS_DETAILED,
            self::TRAINING_CAMPAIGNS,
            self::TRAINING,
            self::CAMPAIGNS,
            self::INTEGRATIONS,
            self::SENDING_PROFILES,
            self::USERS,
            self::ROLES,
            self::TARGETS,
            self::DEPARTMENTS,
            self::GROUPS,
            self::CHECKLISTS,
            self::CHECKLIST_INSTANCES,
            self::TICKETS,
            self::DESKS,
            self::KB,
            self::EMAIL_READERS,
            self::TICKETING_REPORTS,
            self::ANNOUNCEMENTS,
            self::BRANDING,
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

    public static function learnChannel(string $tenantId, int $userId): string
    {
        return "org.{$tenantId}.learn.{$userId}";
    }

    public static function portalChannel(string $tenantId, int $userId): string
    {
        return "org.{$tenantId}.portal.{$userId}";
    }

    public static function notificationsChannel(string $tenantId, int $userId): string
    {
        return "org.{$tenantId}.notifications.{$userId}";
    }

    public static function permissionFor(string $topic): ?string
    {
        return match ($topic) {
            self::METRICS, self::REPORTS, self::REPORTS_DETAILED => OrgPermissionCatalog::REPORTS_VIEW,
            self::REPORTS_EXPORT => OrgPermissionCatalog::REPORTS_EXPORT,
            self::TRAINING_CAMPAIGNS, self::CAMPAIGNS => OrgPermissionCatalog::CAMPAIGNS_MANAGE,
            self::TRAINING => OrgPermissionCatalog::TRAINING_MANAGE,
            self::INTEGRATIONS, self::SENDING_PROFILES, self::BRANDING => OrgPermissionCatalog::SETTINGS_MANAGE,
            self::USERS => OrgPermissionCatalog::USERS_MANAGE,
            self::ROLES => OrgPermissionCatalog::ROLES_MANAGE,
            self::TARGETS => OrgPermissionCatalog::TARGETS_MANAGE,
            self::DEPARTMENTS => OrgPermissionCatalog::DEPARTMENTS_MANAGE,
            self::GROUPS => OrgPermissionCatalog::GROUPS_MANAGE,
            self::CHECKLISTS, self::CHECKLIST_INSTANCES => OrgPermissionCatalog::CHECKLISTS_MANAGE,
            self::TICKETS => OrgPermissionCatalog::TICKETING_TICKETS,
            self::DESKS, self::EMAIL_READERS => OrgPermissionCatalog::TICKETING_ADMIN,
            self::KB => OrgPermissionCatalog::TICKETING_KB,
            self::TICKETING_REPORTS => OrgPermissionCatalog::TICKETING_REPORTS,
            self::ANNOUNCEMENTS => OrgPermissionCatalog::ANNOUNCEMENTS_MANAGE,
            default => null,
        };
    }
}
