/**
 * Message keys for organization permission labels shown in the roles UI. Keys are the
 * stable backend identifiers (`OrgPermissionCatalog`); each maps to an entry under
 * `org.roles.permissionLabels`. Unknown keys have no entry and render as the raw key.
 */
const PERMISSION_LABEL_STEMS: Record<string, string> = {
  "org.users.view": "usersView",
  "org.users.manage": "usersManage",
  "org.roles.manage": "rolesManage",
  "org.targets.view": "targetsView",
  "org.targets.manage": "targetsManage",
  "org.departments.view": "departmentsView",
  "org.departments.manage": "departmentsManage",
  "org.groups.view": "groupsView",
  "org.groups.manage": "groupsManage",
  "org.campaigns.view": "campaignsView",
  "org.campaigns.manage": "campaignsManage",
  "org.training.view": "trainingView",
  "org.training.manage": "trainingManage",
  "org.checklists.view": "checklistsView",
  "org.checklists.fill": "checklistsFill",
  "org.checklists.manage": "checklistsManage",
  "org.ticketing.tickets": "ticketingTickets",
  "org.ticketing.view_all": "ticketingViewAll",
  "org.ticketing.admin": "ticketingAdmin",
  "org.kb.view": "kbView",
  "org.kb.manage": "kbManage",
  "org.ticketing.reports": "ticketingReports",
  "org.ticketing.portal": "ticketingPortal",
  "org.reports.view": "reportsView",
  "org.reports.export": "reportsExport",
  "org.settings.view": "settingsView",
  "org.settings.manage": "settingsManage",
  "org.audit.view": "auditView",
  "org.announcements.manage": "announcementsManage",
};

export type PermissionLabelKeys = {
  /** Message key for the label, relative to the `org.roles` namespace. */
  label: string;
  /** Message key for the description, relative to the `org.roles` namespace. */
  description: string;
};

/** Message keys for a permission's label and description, or null for an unknown permission. */
export function permissionLabelKeys(permission: string): PermissionLabelKeys | null {
  const stem = PERMISSION_LABEL_STEMS[permission];
  if (!stem) {
    return null;
  }
  return {
    label: `permissionLabels.${stem}.label`,
    description: `permissionLabels.${stem}.description`,
  };
}
