import { hasPermission, type SessionUser } from "@/lib/session";

export type DashboardWidgetId =
  | "training"
  | "checklists"
  | "ticketing"
  | "people";

export type DashboardWidgetDef = {
  id: DashboardWidgetId;
  title: string;
  href: string;
  hrefLabel: string;
};

const WIDGETS: DashboardWidgetDef[] = [
  {
    id: "training",
    title: "Training",
    href: "/org/training",
    hrefLabel: "Open training",
  },
  {
    id: "checklists",
    title: "Checklists",
    href: "/org/checklists/instances",
    hrefLabel: "Open checklists",
  },
  {
    id: "ticketing",
    title: "Ticketing",
    href: "/org/ticketing",
    hrefLabel: "Open ticketing",
  },
  {
    id: "people",
    title: "People",
    href: "/org/users",
    hrefLabel: "Open users",
  },
];

export type DashboardModuleLink = {
  href: string;
  label: string;
  permission: string;
};

/** Permission-filtered module deep links for empty / limited dashboards. */
export const DASHBOARD_MODULE_LINKS: DashboardModuleLink[] = [
  { href: "/org/training", label: "Training", permission: "org.training.manage" },
  { href: "/org/courses", label: "Courses", permission: "org.training.manage" },
  { href: "/org/checklists", label: "Checklists", permission: "org.checklists.manage" },
  { href: "/org/ticketing", label: "Ticketing", permission: "org.ticketing.tickets" },
  { href: "/org/targets", label: "Employees", permission: "org.targets.manage" },
  { href: "/org/users", label: "Users", permission: "org.users.manage" },
  { href: "/org/reports", label: "Reporting", permission: "org.reports.view" },
  { href: "/org/reports/export", label: "Export", permission: "org.reports.export" },
  { href: "/org/settings", label: "Settings", permission: "org.settings.manage" },
];

export function canShowTrainingWidget(user: SessionUser | null): boolean {
  return (
    hasPermission(user, "org.reports.view") ||
    hasPermission(user, "org.training.manage")
  );
}

export function canShowChecklistsWidget(user: SessionUser | null): boolean {
  return hasPermission(user, "org.checklists.manage");
}

export function canShowTicketingWidget(user: SessionUser | null): boolean {
  return (
    hasPermission(user, "org.ticketing.tickets") ||
    hasPermission(user, "org.ticketing.reports")
  );
}

export function canShowPeopleWidget(user: SessionUser | null): boolean {
  return hasPermission(user, "org.users.manage");
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
  });
}

export function resolveDashboardModuleLinks(
  user: SessionUser | null,
): Array<{ href: string; label: string }> {
  return DASHBOARD_MODULE_LINKS.filter((link) =>
    hasPermission(user, link.permission),
  ).map(({ href, label }) => ({ href, label }));
}
