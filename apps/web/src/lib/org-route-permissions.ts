/**
 * Page-level permission gates for the org workspace (`/org/...`).
 *
 * Rules are checked in order and the first match wins, so list the more specific
 * paths before their parents. A rule with an empty `anyOf` is open to every member.
 * Paths with no rule are not restricted here; the API still enforces access.
 *
 * Each rule mirrors either the page's own permission check, or, for pages without
 * one, the permissions of the endpoint the page reads (`apps/api/routes/api.php`).
 */

type OrgRouteRule = {
  match: (pathname: string) => boolean;
  /** Any one of these permissions grants access. Empty means open to every member. */
  anyOf: readonly string[];
};

const PERMISSION = {
  ANNOUNCEMENTS_MANAGE: "org.announcements.manage",
  AUDIT_VIEW: "org.audit.view",
  CAMPAIGNS_MANAGE: "org.campaigns.manage",
  CAMPAIGNS_VIEW: "org.campaigns.view",
  CHECKLISTS_FILL: "org.checklists.fill",
  CHECKLISTS_MANAGE: "org.checklists.manage",
  CHECKLISTS_VIEW: "org.checklists.view",
  DEPARTMENTS_MANAGE: "org.departments.manage",
  DEPARTMENTS_VIEW: "org.departments.view",
  GROUPS_MANAGE: "org.groups.manage",
  GROUPS_VIEW: "org.groups.view",
  KB_MANAGE: "org.kb.manage",
  KB_VIEW: "org.kb.view",
  REPORTS_EXPORT: "org.reports.export",
  REPORTS_VIEW: "org.reports.view",
  ROLES_MANAGE: "org.roles.manage",
  SETTINGS_MANAGE: "org.settings.manage",
  SETTINGS_VIEW: "org.settings.view",
  TARGETS_MANAGE: "org.targets.manage",
  TARGETS_VIEW: "org.targets.view",
  TICKETING_ADMIN: "org.ticketing.admin",
  TICKETING_REPORTS: "org.ticketing.reports",
  TICKETING_TICKETS: "org.ticketing.tickets",
  TRAINING_MANAGE: "org.training.manage",
  TRAINING_VIEW: "org.training.view",
  USERS_MANAGE: "org.users.manage",
  USERS_VIEW: "org.users.view",
} as const;

/** Matches `path` itself and anything below it, on whole path segments only. */
function underPath(path: string): (pathname: string) => boolean {
  return (pathname) => pathname === path || pathname.startsWith(`${path}/`);
}

/** Matches a single-segment detail page such as `/org/targets/12`. */
const singleSegmentUnder = (path: string) =>
  (pathname: string) =>
    pathname.startsWith(`${path}/`) && !pathname.slice(path.length + 1).includes("/");

const ORG_ROUTE_RULES: readonly OrgRouteRule[] = [
  // Per-account MFA page: open to every member.
  { match: underPath("/org/settings/mfa"), anyOf: [] },
  { match: underPath("/org/settings/integrations"), anyOf: [PERMISSION.SETTINGS_MANAGE] },
  { match: underPath("/org/settings/sending-profiles"), anyOf: [PERMISSION.SETTINGS_MANAGE] },
  { match: underPath("/org/settings"), anyOf: [PERMISSION.SETTINGS_VIEW, PERMISSION.SETTINGS_MANAGE] },

  { match: underPath("/org/reports/export"), anyOf: [PERMISSION.REPORTS_EXPORT] },
  { match: underPath("/org/reports"), anyOf: [PERMISSION.REPORTS_VIEW] },

  { match: underPath("/org/ticketing/desks"), anyOf: [PERMISSION.TICKETING_TICKETS, PERMISSION.TICKETING_ADMIN] },
  { match: underPath("/org/ticketing/email"), anyOf: [PERMISSION.TICKETING_ADMIN] },
  { match: underPath("/org/ticketing/reports"), anyOf: [PERMISSION.TICKETING_REPORTS] },
  { match: underPath("/org/ticketing"), anyOf: [PERMISSION.TICKETING_TICKETS] },

  {
    match: underPath("/org/checklists/instances"),
    anyOf: [PERMISSION.CHECKLISTS_VIEW, PERMISSION.CHECKLISTS_FILL, PERMISSION.CHECKLISTS_MANAGE],
  },
  { match: underPath("/org/checklists"), anyOf: [PERMISSION.CHECKLISTS_VIEW, PERMISSION.CHECKLISTS_MANAGE] },

  { match: underPath("/org/training/campaigns"), anyOf: [PERMISSION.CAMPAIGNS_VIEW, PERMISSION.CAMPAIGNS_MANAGE] },
  { match: underPath("/org/training"), anyOf: [PERMISSION.TRAINING_VIEW, PERMISSION.TRAINING_MANAGE] },
  { match: underPath("/org/campaigns"), anyOf: [PERMISSION.CAMPAIGNS_VIEW, PERMISSION.CAMPAIGNS_MANAGE] },
  {
    match: underPath("/org/courses"),
    anyOf: [PERMISSION.TRAINING_VIEW, PERMISSION.TRAINING_MANAGE, PERMISSION.CAMPAIGNS_MANAGE],
  },

  { match: underPath("/org/kb"), anyOf: [PERMISSION.KB_VIEW, PERMISSION.KB_MANAGE] },
  { match: underPath("/org/announcements"), anyOf: [PERMISSION.ANNOUNCEMENTS_MANAGE] },
  { match: underPath("/org/audit"), anyOf: [PERMISSION.AUDIT_VIEW] },
  { match: underPath("/org/roles"), anyOf: [PERMISSION.ROLES_MANAGE] },
  { match: underPath("/org/users"), anyOf: [PERMISSION.USERS_VIEW, PERMISSION.USERS_MANAGE] },
  { match: underPath("/org/groups"), anyOf: [PERMISSION.GROUPS_VIEW, PERMISSION.GROUPS_MANAGE] },
  {
    match: underPath("/org/departments"),
    anyOf: [
      PERMISSION.DEPARTMENTS_VIEW,
      PERMISSION.DEPARTMENTS_MANAGE,
      PERMISSION.TARGETS_MANAGE,
      PERMISSION.USERS_MANAGE,
      PERMISSION.REPORTS_VIEW,
    ],
  },

  { match: singleSegmentUnder("/org/targets"), anyOf: [PERMISSION.TARGETS_VIEW, PERMISSION.TARGETS_MANAGE] },
  {
    match: underPath("/org/targets"),
    anyOf: [
      PERMISSION.TARGETS_VIEW,
      PERMISSION.TARGETS_MANAGE,
      PERMISSION.GROUPS_VIEW,
      PERMISSION.GROUPS_MANAGE,
      PERMISSION.USERS_VIEW,
      PERMISSION.USERS_MANAGE,
    ],
  },
];

/** Permissions that grant access to `pathname`. Empty means no page-level restriction. */
export function requiredPermissionsFor(pathname: string): readonly string[] {
  const rule = ORG_ROUTE_RULES.find((candidate) => candidate.match(pathname));
  return rule?.anyOf ?? [];
}

/** True when the path has a gate and the user holds none of the permissions it lists. */
export function isOrgRouteDenied(pathname: string, permissions: readonly string[]): boolean {
  const required = requiredPermissionsFor(pathname);
  return required.length > 0 && !required.some((permission) => permissions.includes(permission));
}
