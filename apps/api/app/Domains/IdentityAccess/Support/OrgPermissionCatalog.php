<?php

namespace App\Domains\IdentityAccess\Support;

final class OrgPermissionCatalog
{
    public const GUARD = 'web';

    public const PLATFORM_SUPER_ADMIN = 'platform_super_admin';

    public const PLATFORM_AGENT = 'platform_agent';

    public const ORG_ADMIN = 'org_admin';

    public const LEARNER = 'learner';

    /** @deprecated Use PLATFORM_SUPER_ADMIN */
    public const LEGACY_PARTNER_ADMIN = 'partner_admin';

    /** @deprecated Use PLATFORM_AGENT */
    public const LEGACY_PARTNER_AGENT = 'partner_agent';

    /** @deprecated Use ORG_ADMIN */
    public const LEGACY_CLIENT_ADMIN = 'client_admin';

    public const USERS_MANAGE = 'org.users.manage';

    public const ROLES_MANAGE = 'org.roles.manage';

    public const TARGETS_MANAGE = 'org.targets.manage';

    public const GROUPS_MANAGE = 'org.groups.manage';

    public const CAMPAIGNS_MANAGE = 'org.campaigns.manage';

    public const TRAINING_MANAGE = 'org.training.manage';

    public const CHECKLISTS_MANAGE = 'org.checklists.manage';

    public const TICKETING_TICKETS = 'org.ticketing.tickets';

    public const TICKETING_ADMIN = 'org.ticketing.admin';

    public const TICKETING_KB = 'org.ticketing.kb';

    public const TICKETING_REPORTS = 'org.ticketing.reports';

    public const TICKETING_PORTAL = 'org.ticketing.portal';

    public const REPORTS_VIEW = 'org.reports.view';

    public const REPORTS_EXPORT = 'org.reports.export';

    public const SETTINGS_MANAGE = 'org.settings.manage';

    public const ANNOUNCEMENTS_MANAGE = 'org.announcements.manage';

    public const SD_ADMIN = 'sd_admin';

    public const SD_TECHNICIAN = 'sd_technician';

    public const SD_USER = 'sd_user';

    public const KB_ADMIN = 'kb_admin';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::USERS_MANAGE,
            self::ROLES_MANAGE,
            self::TARGETS_MANAGE,
            self::GROUPS_MANAGE,
            self::CAMPAIGNS_MANAGE,
            self::TRAINING_MANAGE,
            self::CHECKLISTS_MANAGE,
            self::TICKETING_TICKETS,
            self::TICKETING_ADMIN,
            self::TICKETING_KB,
            self::TICKETING_REPORTS,
            self::TICKETING_PORTAL,
            self::REPORTS_VIEW,
            self::REPORTS_EXPORT,
            self::SETTINGS_MANAGE,
            self::ANNOUNCEMENTS_MANAGE,
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    public static function ticketingRolePermissions(): array
    {
        return [
            self::SD_ADMIN => [
                self::TICKETING_TICKETS,
                self::TICKETING_ADMIN,
                self::TICKETING_KB,
                self::TICKETING_REPORTS,
            ],
            self::SD_TECHNICIAN => [
                self::TICKETING_TICKETS,
                self::TICKETING_KB,
            ],
            self::SD_USER => [
                self::TICKETING_TICKETS,
            ],
            self::KB_ADMIN => [
                self::TICKETING_KB,
                self::TICKETING_TICKETS,
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function platformRoles(): array
    {
        return [self::PLATFORM_SUPER_ADMIN, self::PLATFORM_AGENT];
    }
}
