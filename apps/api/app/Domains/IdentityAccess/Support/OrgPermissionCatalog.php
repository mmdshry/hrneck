<?php

namespace App\Domains\IdentityAccess\Support;

use App\Models\User;

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

    public const USERS_VIEW = 'org.users.view';

    public const ROLES_MANAGE = 'org.roles.manage';

    public const TARGETS_MANAGE = 'org.targets.manage';

    public const TARGETS_VIEW = 'org.targets.view';

    public const DEPARTMENTS_MANAGE = 'org.departments.manage';

    public const DEPARTMENTS_VIEW = 'org.departments.view';

    public const GROUPS_MANAGE = 'org.groups.manage';

    public const GROUPS_VIEW = 'org.groups.view';

    public const CAMPAIGNS_MANAGE = 'org.campaigns.manage';

    public const CAMPAIGNS_VIEW = 'org.campaigns.view';

    public const TRAINING_MANAGE = 'org.training.manage';

    public const TRAINING_VIEW = 'org.training.view';

    public const CHECKLISTS_MANAGE = 'org.checklists.manage';

    public const CHECKLISTS_VIEW = 'org.checklists.view';

    /** Fill checklist instances (answer items, attach media) without template or pack management. */
    public const CHECKLISTS_FILL = 'org.checklists.fill';

    public const TICKETING_TICKETS = 'org.ticketing.tickets';

    public const TICKETING_ADMIN = 'org.ticketing.admin';

    /** View knowledge base articles and search results. */
    public const KB_VIEW = 'org.kb.view';

    /** Create, edit, publish, and delete knowledge base articles, and convert tickets into articles. */
    public const KB_MANAGE = 'org.kb.manage';

    public const TICKETING_REPORTS = 'org.ticketing.reports';

    public const TICKETING_PORTAL = 'org.ticketing.portal';

    public const REPORTS_VIEW = 'org.reports.view';

    public const REPORTS_EXPORT = 'org.reports.export';

    public const SETTINGS_MANAGE = 'org.settings.manage';

    public const SETTINGS_VIEW = 'org.settings.view';

    /** Read the organization's activity log (audit trail). */
    public const AUDIT_VIEW = 'org.audit.view';

    public const ANNOUNCEMENTS_MANAGE = 'org.announcements.manage';

    public const SD_ADMIN = 'sd_admin';

    public const SD_TECHNICIAN = 'sd_technician';

    public const SD_USER = 'sd_user';

    public const KB_ADMIN = 'kb_admin';

    /**
     * Without this permission a ticketing user only sees tickets they requested or are assigned to.
     */
    public const TICKETING_VIEW_ALL = 'org.ticketing.view_all';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::USERS_MANAGE,
            self::USERS_VIEW,
            self::ROLES_MANAGE,
            self::TARGETS_MANAGE,
            self::TARGETS_VIEW,
            self::DEPARTMENTS_MANAGE,
            self::DEPARTMENTS_VIEW,
            self::GROUPS_MANAGE,
            self::GROUPS_VIEW,
            self::CAMPAIGNS_MANAGE,
            self::CAMPAIGNS_VIEW,
            self::TRAINING_MANAGE,
            self::TRAINING_VIEW,
            self::CHECKLISTS_MANAGE,
            self::CHECKLISTS_VIEW,
            self::CHECKLISTS_FILL,
            self::TICKETING_TICKETS,
            self::TICKETING_ADMIN,
            self::TICKETING_REPORTS,
            self::TICKETING_PORTAL,
            self::TICKETING_VIEW_ALL,
            self::KB_VIEW,
            self::KB_MANAGE,
            self::REPORTS_VIEW,
            self::REPORTS_EXPORT,
            self::SETTINGS_MANAGE,
            self::SETTINGS_VIEW,
            self::AUDIT_VIEW,
            self::ANNOUNCEMENTS_MANAGE,
        ];
    }

    /**
     * Permissions that open a page in the organization workspace (/org). An account holding none
     * of these is an employee-only account and lands on the employee dashboard after sign-in.
     *
     * @return list<string>
     */
    public static function workspacePermissions(): array
    {
        return [
            self::USERS_VIEW,
            self::USERS_MANAGE,
            self::ROLES_MANAGE,
            self::TARGETS_VIEW,
            self::TARGETS_MANAGE,
            self::DEPARTMENTS_VIEW,
            self::DEPARTMENTS_MANAGE,
            self::GROUPS_VIEW,
            self::GROUPS_MANAGE,
            self::CAMPAIGNS_VIEW,
            self::CAMPAIGNS_MANAGE,
            self::TRAINING_VIEW,
            self::TRAINING_MANAGE,
            self::CHECKLISTS_VIEW,
            self::CHECKLISTS_MANAGE,
            self::CHECKLISTS_FILL,
            self::TICKETING_TICKETS,
            self::KB_VIEW,
            self::KB_MANAGE,
            self::REPORTS_VIEW,
            self::REPORTS_EXPORT,
            self::ANNOUNCEMENTS_MANAGE,
            self::AUDIT_VIEW,
            self::SETTINGS_VIEW,
            self::SETTINGS_MANAGE,
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
                self::KB_VIEW,
                self::KB_MANAGE,
                self::TICKETING_REPORTS,
                self::TICKETING_VIEW_ALL,
            ],
            self::SD_TECHNICIAN => [
                self::TICKETING_TICKETS,
                self::KB_VIEW,
                self::KB_MANAGE,
                self::TICKETING_VIEW_ALL,
            ],
            // Requester/assignee-scoped: sees only its own and assigned tickets.
            self::SD_USER => [
                self::TICKETING_TICKETS,
            ],
            self::KB_ADMIN => [
                self::KB_VIEW,
                self::KB_MANAGE,
                self::TICKETING_TICKETS,
                self::TICKETING_VIEW_ALL,
            ],
        ];
    }

    /**
     * Starter roles created once per organization. Existing roles are never overwritten,
     * so admins can freely edit or delete them afterwards.
     *
     * @return array<string, list<string>>
     */
    public static function templateRolePermissions(): array
    {
        return [
            'hr_manager' => [
                self::USERS_MANAGE,
                self::USERS_VIEW,
                self::TARGETS_MANAGE,
                self::TARGETS_VIEW,
                self::DEPARTMENTS_MANAGE,
                self::DEPARTMENTS_VIEW,
                self::GROUPS_VIEW,
                self::REPORTS_VIEW,
                self::CHECKLISTS_VIEW,
                self::CHECKLISTS_FILL,
            ],
            'helpdesk_agent' => [
                self::TICKETING_TICKETS,
                self::KB_VIEW,
                self::KB_MANAGE,
                self::TICKETING_VIEW_ALL,
            ],
            'auditor' => [
                self::AUDIT_VIEW,
                self::REPORTS_VIEW,
                self::USERS_VIEW,
                self::TARGETS_VIEW,
                self::DEPARTMENTS_VIEW,
                self::GROUPS_VIEW,
                self::CAMPAIGNS_VIEW,
                self::TRAINING_VIEW,
                self::CHECKLISTS_VIEW,
                self::SETTINGS_VIEW,
            ],
            'campaign_manager' => [
                self::CAMPAIGNS_MANAGE,
                self::CAMPAIGNS_VIEW,
                self::TRAINING_VIEW,
                self::GROUPS_VIEW,
                self::TARGETS_VIEW,
                self::REPORTS_VIEW,
            ],
            'it_viewer' => [
                self::TICKETING_TICKETS,
                self::KB_VIEW,
                self::TICKETING_REPORTS,
                self::CHECKLISTS_VIEW,
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

    /**
     * Org permissions elevated for platform agents after MSP tenant enter.
     * Excludes role/settings management to limit privilege blast radius.
     *
     * @return list<string>
     */
    public static function staffTenantPermissions(): array
    {
        return array_values(array_filter(
            self::all(),
            static fn (string $permission): bool => ! in_array($permission, [
                self::ROLES_MANAGE,
                self::SETTINGS_MANAGE,
                self::SETTINGS_VIEW,
            ], true),
        ));
    }

    /**
     * Org permissions a platform staff member may use while acting in a tenant.
     * Platform super admins get the full catalog (including roles and settings);
     * every other platform staff role falls back to {@see staffTenantPermissions()}.
     *
     * @return list<string>
     */
    public static function staffTenantPermissionsFor(User $user): array
    {
        if ($user->isPlatformSuperAdmin()) {
            return self::all();
        }

        return self::staffTenantPermissions();
    }
}
