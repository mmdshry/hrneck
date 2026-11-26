import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/session";
import { buildPortalNav, type PortalNavLabels } from "./portal-nav";

const labels: PortalNavLabels = {
  myCourses: "My courses",
  myTickets: "My tickets",
  knowledgeBase: "Knowledge base",
  accountMfa: "Account / MFA",
};

type UserOptions = {
  learnerPortal?: boolean;
  hasOrgAccess?: boolean;
  platformStaff?: boolean;
};

function user(permissions: string[], options: UserOptions = {}): SessionUser {
  return {
    id: 7,
    name: "Learner",
    email: "learner@itneck.test",
    tenant_id: "itneck",
    roles: ["learner"],
    permissions,
    is_platform_staff: options.platformStaff ?? false,
    has_org_access: options.hasOrgAccess ?? false,
    ...(options.learnerPortal === undefined
      ? {}
      : {
          subscription: {
            plan_name: "Growth",
            status: "active",
            effective_status: "active",
            read_only: false,
            ends_at: null,
            over_limit: false,
            usage: {
              employees: { used: 1, limit: null, over_limit: false },
              users: { used: 1, limit: null, over_limit: false },
            },
            features: { learner_portal: options.learnerPortal },
          },
        }),
  };
}

function menu(sessionUser: SessionUser | null): string[] {
  return buildPortalNav(sessionUser, labels).map((item) => item.label);
}

describe("buildPortalNav", () => {
  it("shows the employee pages and the account entries to a learner without console access", () => {
    expect(menu(user([]))).toEqual([
      "My courses",
      "My tickets",
      "Knowledge base",
      "Account / MFA",
      "Guides",
    ]);
  });

  it("hides My courses when the plan does not include the learner portal", () => {
    expect(menu(user([], { learnerPortal: false }))).toEqual([
      "My tickets",
      "Knowledge base",
      "Account / MFA",
      "Guides",
    ]);
  });

  it("keeps My courses when the plan includes the learner portal", () => {
    expect(menu(user([], { learnerPortal: true }))[0]).toBe("My courses");
  });

  it("adds a permitted organization menu item after the employee pages", () => {
    expect(menu(user(["org.ticketing.tickets"]))).toEqual([
      "My courses",
      "My tickets",
      "Knowledge base",
      "Account / MFA",
      "Ticketing",
      "Guides",
    ]);
  });

  it("does not show the org Dashboard to a user without org access", () => {
    expect(menu(user(["org.training.view"]))).not.toContain("Dashboard");
  });

  it("shows the org Dashboard to a user with org access, right after the employee pages", () => {
    expect(menu(user(["org.training.view"], { hasOrgAccess: true }))).toEqual([
      "My courses",
      "My tickets",
      "Knowledge base",
      "Account / MFA",
      "Dashboard",
      "Training",
      "Courses",
      "Guides",
    ]);
  });

  it("links Account / MFA to the portal copy and never to the org console", () => {
    const hrefs = buildPortalNav(user(["org.roles.manage"], { hasOrgAccess: true }), labels).map(
      (item) => item.href,
    );
    expect(hrefs).toContain("/portal/account");
    expect(hrefs).not.toContain("/org/settings/mfa");
  });

  it("shows the platform Organizations entry only to platform staff", () => {
    expect(menu(user([]))).not.toContain("Organizations");
    expect(menu(user([], { platformStaff: true }))).toContain("Organizations");
  });

  it("lists My courses first, then My tickets and Knowledge base, with exact matching on the dashboard", () => {
    const items = buildPortalNav(user([]), labels);
    expect(items[0]).toMatchObject({ href: "/portal", exact: true });
    expect(items[1]).toMatchObject({ href: "/portal/tickets" });
    expect(items[2]).toMatchObject({ href: "/portal/kb" });
  });

  it("keeps the employee pages and account entries before the user has loaded", () => {
    expect(menu(null)).toEqual([
      "My courses",
      "My tickets",
      "Knowledge base",
      "Account / MFA",
      "Guides",
    ]);
  });
});
