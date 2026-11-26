import {
  BarChart3,
  ClipboardList,
  ContactRound,
  Download,
  GraduationCap,
  KeyRound,
  Layers,
  Library,
  Megaphone,
  Settings2,
  Ticket,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { hasAnyPermission, hasPermission, type SessionUser } from "@/lib/session";

/**
 * Module keys shared by metric widgets and quick-access shortcuts.
 * Each key doubles as the `nav.*` i18n label key.
 */
export type DashboardNavKey =
  | "training"
  | "courses"
  | "checklists"
  | "ticketing"
  | "employees"
  | "departments"
  | "groups"
  | "roles"
  | "reporting"
  | "export"
  | "announcements"
  | "settings";

export type DashboardWidgetId =
  | "training"
  | "checklists"
  | "ticketing"
  | "people";

type DashboardNavEntry = {
  href: string;
  icon: LucideIcon;
  /** Any one of these permissions opens the module (view or manage). */
  permissions: readonly string[];
};

/** Employees and login accounts are one list, so either family opens it. */
const EMPLOYEE_PERMISSIONS = [
  "org.targets.view",
  "org.targets.manage",
  "org.users.view",
  "org.users.manage",
] as const;

/**
 * Mirrors the sidebar menu `ORG_NAV` in `lib/org-nav.ts` (same href, icon,
 * and permissions per module). Keep the two in sync when adding modules.
 */
const DASHBOARD_NAV: Record<DashboardNavKey, DashboardNavEntry> = {
  training: {
    href: "/org/training",
    icon: GraduationCap,
    permissions: ["org.training.view", "org.training.manage"],
  },
  courses: {
    href: "/org/courses",
    icon: Library,
    permissions: ["org.training.view", "org.training.manage"],
  },
  checklists: {
    href: "/org/checklists",
    icon: ClipboardList,
    permissions: ["org.checklists.view", "org.checklists.fill", "org.checklists.manage"],
  },
  ticketing: {
    href: "/org/ticketing",
    icon: Ticket,
    permissions: ["org.ticketing.tickets"],
  },
  employees: {
    href: "/org/targets",
    icon: ContactRound,
    permissions: EMPLOYEE_PERMISSIONS,
  },
  departments: {
    href: "/org/departments",
    icon: Layers,
    permissions: ["org.departments.view", "org.departments.manage"],
  },
  groups: {
    href: "/org/groups",
    icon: UsersRound,
    permissions: ["org.groups.view", "org.groups.manage"],
  },
  roles: {
    href: "/org/roles",
    icon: KeyRound,
    permissions: ["org.roles.manage"],
  },
  reporting: {
    href: "/org/reports",
    icon: BarChart3,
    permissions: ["org.reports.view"],
  },
  export: {
    href: "/org/reports/export",
    icon: Download,
    permissions: ["org.reports.export"],
  },
  announcements: {
    href: "/org/announcements",
    icon: Megaphone,
    permissions: ["org.announcements.manage"],
  },
  settings: {
    href: "/org/settings",
    icon: Settings2,
    permissions: ["org.settings.view", "org.settings.manage"],
  },
};

const NAV_KEYS = Object.keys(DASHBOARD_NAV) as DashboardNavKey[];

const WIDGETS: Array<{ id: DashboardWidgetId; navKey: DashboardNavKey }> = [
  { id: "training", navKey: "training" },
  { id: "checklists", navKey: "checklists" },
  { id: "ticketing", navKey: "ticketing" },
  { id: "people", navKey: "employees" },
];

export type DashboardWidgetDef = {
  id: DashboardWidgetId;
  navKey: DashboardNavKey;
  icon: LucideIcon;
  href: string;
};

export type DashboardShortcut = {
  navKey: DashboardNavKey;
  href: string;
  icon: LucideIcon;
};

export function canShowTrainingWidget(user: SessionUser | null): boolean {
  return (
    hasPermission(user, "org.reports.view") ||
    hasAnyPermission(user, ["org.training.view", "org.training.manage"])
  );
}

export function canShowChecklistsWidget(user: SessionUser | null): boolean {
  return hasAnyPermission(user, [
    "org.checklists.view",
    "org.checklists.fill",
    "org.checklists.manage",
  ]);
}

export function canShowTicketingWidget(user: SessionUser | null): boolean {
  return (
    hasPermission(user, "org.ticketing.tickets") ||
    hasPermission(user, "org.ticketing.reports")
  );
}

export function canShowPeopleWidget(user: SessionUser | null): boolean {
  return hasAnyPermission(user, EMPLOYEE_PERMISSIONS);
}

export function resolveDashboardWidgets(
  user: SessionUser | null,
): DashboardWidgetDef[] {
  return WIDGETS.filter((widget) => {
    switch (widget.id) {
      case "training":
        return canShowTrainingWidget(user);
      case "checklists":
        return canShowChecklistsWidget(user);
      case "ticketing":
        return canShowTicketingWidget(user);
      case "people":
        return canShowPeopleWidget(user);
      default: {
        const _exhaustive: never = widget.id;
        return _exhaustive;
      }
    }
  }).map(({ id, navKey }) => ({
    id,
    navKey,
    icon: DASHBOARD_NAV[navKey].icon,
    href: DASHBOARD_NAV[navKey].href,
  }));
}

/**
 * Permitted module shortcuts, excluding modules that already render a metric
 * card (`coveredNavKeys`) so the same destination is never shown twice.
 */
export function resolveDashboardModuleLinks(
  user: SessionUser | null,
  coveredNavKeys: ReadonlySet<DashboardNavKey>,
): DashboardShortcut[] {
  return NAV_KEYS.filter(
    (navKey) =>
      !coveredNavKeys.has(navKey) &&
      hasAnyPermission(user, DASHBOARD_NAV[navKey].permissions),
  ).map((navKey) => ({
    navKey,
    href: DASHBOARD_NAV[navKey].href,
    icon: DASHBOARD_NAV[navKey].icon,
  }));
}
