import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/session";
import {
  resolveDashboardModuleLinks,
  resolveDashboardWidgets,
  type DashboardNavKey,
} from "./dashboard-widgets";

const ALL_ORG_PERMISSIONS = [
  "org.training.manage",
  "org.reports.view",
  "org.reports.export",
  "org.checklists.manage",
  "org.ticketing.tickets",
  "org.ticketing.reports",
  "org.targets.manage",
  "org.departments.manage",
  "org.groups.manage",
  "org.users.manage",
  "org.roles.manage",
  "org.announcements.manage",
  "org.settings.manage",
];

function orgUser(permissions: string[]): SessionUser {
  return {
    id: 1,
    name: "Org Admin",
    email: "admin@itneck.test",
    tenant_id: "itneck",
    roles: ["org_admin"],
    permissions,
    is_platform_staff: false,
  };
}

function staffUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 2,
    name: "Platform Admin",
    email: "admin@hrneck.test",
    tenant_id: null,
    roles: ["super_admin"],
    permissions: [],
    is_platform_staff: true,
    staff_tenant_id: null,
    acting_in_tenant: false,
    ...overrides,
  };
}

/** Mirrors how OrgDashboardClient derives cards and shortcuts from one user. */
function dashboardFor(user: SessionUser | null) {
  const widgets = resolveDashboardWidgets(user);
  const covered = new Set<DashboardNavKey>(widgets.map((w) => w.navKey));
  const shortcuts = resolveDashboardModuleLinks(user, covered);
  return {
    widgets: widgets.map((w) => w.navKey),
    shortcuts: shortcuts.map((s) => s.navKey),
  };
}

describe("org dashboard cards and shortcuts", () => {
  it("shows every card and only the uncovered shortcuts for a full org admin", () => {
    expect(dashboardFor(orgUser(ALL_ORG_PERMISSIONS))).toEqual({
      widgets: ["training", "checklists", "ticketing", "employees"],
      shortcuts: [
        "courses",
        "departments",
        "groups",
        "roles",
        "reporting",
        "export",
        "announcements",
        "settings",
      ],
    });
  });

  it("never lists a module as both a card and a shortcut", () => {
    const { widgets, shortcuts } = dashboardFor(orgUser(ALL_ORG_PERMISSIONS));
    expect(shortcuts.filter((key) => widgets.includes(key))).toEqual([]);
  });

  it("shows only the training card for reports-only access, with no duplicate shortcut", () => {
    expect(dashboardFor(orgUser(["org.reports.view"]))).toEqual({
      widgets: ["training"],
      shortcuts: ["reporting"],
    });
  });

  it("keeps a shortcut when its module has no metric card", () => {
    expect(
      dashboardFor(orgUser(["org.training.manage", "org.checklists.manage"])),
    ).toEqual({
      widgets: ["training", "checklists"],
      shortcuts: ["courses"],
    });
  });

  it("hides the shortcut for a module whose card is shown", () => {
    expect(dashboardFor(orgUser(["org.checklists.manage"]))).toEqual({
      widgets: ["checklists"],
      shortcuts: [],
    });
  });

  it("shows the employees card to a user who can only manage employees, with no shortcut", () => {
    expect(dashboardFor(orgUser(["org.targets.manage"]))).toEqual({
      widgets: ["employees"],
      shortcuts: [],
    });
  });

  it("shows nothing to a user without org permissions", () => {
    expect(dashboardFor(orgUser([]))).toEqual({ widgets: [], shortcuts: [] });
  });

  it("hides dashboard content from platform staff who are not acting in a tenant", () => {
    expect(dashboardFor(staffUser())).toEqual({ widgets: [], shortcuts: [] });
  });

  it("shows cards and shortcuts for platform agents acting in a tenant, without roles or settings", () => {
    // Mirrors the API list OrgPermissionCatalog::staffTenantPermissions() returns for agents.
    const agentPermissions = ALL_ORG_PERMISSIONS.filter(
      (permission) =>
        permission !== "org.roles.manage" && permission !== "org.settings.manage",
    );
    expect(
      dashboardFor(
        staffUser({
          acting_in_tenant: true,
          staff_tenant_id: "itneck",
          permissions: agentPermissions,
        }),
      ),
    ).toEqual({
      widgets: ["training", "checklists", "ticketing", "employees"],
      shortcuts: [
        "courses",
        "departments",
        "groups",
        "reporting",
        "export",
        "announcements",
      ],
    });
  });

  it("shows roles and settings shortcuts for a platform super admin acting in a tenant", () => {
    expect(
      dashboardFor(
        staffUser({
          acting_in_tenant: true,
          staff_tenant_id: "itneck",
          permissions: ALL_ORG_PERMISSIONS,
        }),
      ),
    ).toEqual({
      widgets: ["training", "checklists", "ticketing", "employees"],
      shortcuts: [
        "courses",
        "departments",
        "groups",
        "roles",
        "reporting",
        "export",
        "announcements",
        "settings",
      ],
    });
  });

  it("maps the people card to the merged employees list and its route", () => {
    expect(
      resolveDashboardWidgets(orgUser(["org.users.manage"])),
    ).toMatchObject([{ id: "people", navKey: "employees", href: "/org/targets" }]);
  });

  it("links the checklists card to the checklists overview", () => {
    expect(
      resolveDashboardWidgets(orgUser(["org.checklists.manage"])),
    ).toMatchObject([
      { id: "checklists", navKey: "checklists", href: "/org/checklists" },
    ]);
  });

  it("excludes only the covered keys the caller passes in", () => {
    const shortcuts = resolveDashboardModuleLinks(
      orgUser(["org.checklists.manage"]),
      new Set<DashboardNavKey>(),
    );
    expect(shortcuts.map((s) => s.navKey)).toEqual(["checklists"]);
  });

  it("gives every card and shortcut an org route and an icon", () => {
    const user = orgUser(ALL_ORG_PERMISSIONS);
    const cards = resolveDashboardWidgets(user);
    const shortcuts = resolveDashboardModuleLinks(user, new Set());

    for (const item of [...cards, ...shortcuts]) {
      expect(item.href.startsWith("/org/")).toBe(true);
      expect(item.icon).toBeTruthy();
    }
  });
});
