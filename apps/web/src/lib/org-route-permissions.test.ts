import { describe, expect, it } from "vitest";
import { isOrgRouteDenied, requiredPermissionsFor } from "./org-route-permissions";

describe("requiredPermissionsFor", () => {
  it("leaves the dashboard and the per-account MFA page open", () => {
    expect(requiredPermissionsFor("/org")).toEqual([]);
    expect(requiredPermissionsFor("/org/settings/mfa")).toEqual([]);
    expect(requiredPermissionsFor("/org/notifications")).toEqual([]);
  });

  it("matches whole path segments only", () => {
    expect(requiredPermissionsFor("/org/rolesx")).toEqual([]);
    expect(requiredPermissionsFor("/org/roles")).toEqual(["org.roles.manage"]);
    expect(requiredPermissionsFor("/org/roles/")).toEqual(["org.roles.manage"]);
  });

  it("prefers the most specific rule", () => {
    expect(requiredPermissionsFor("/org/reports")).toEqual(["org.reports.view"]);
    expect(requiredPermissionsFor("/org/reports/export")).toEqual(["org.reports.export"]);
    expect(requiredPermissionsFor("/org/settings/integrations")).toEqual(["org.settings.manage"]);
    expect(requiredPermissionsFor("/org/settings")).toEqual([
      "org.settings.view",
      "org.settings.manage",
    ]);
    expect(requiredPermissionsFor("/org/training/campaigns")).toEqual([
      "org.campaigns.view",
      "org.campaigns.manage",
    ]);
  });

  it("gates checklist instances and templates differently", () => {
    expect(requiredPermissionsFor("/org/checklists/instances/12")).toContain("org.checklists.fill");
    expect(requiredPermissionsFor("/org/checklists/packs/3")).not.toContain("org.checklists.fill");
  });

  it("gates ticketing sub-pages by their own permission", () => {
    expect(requiredPermissionsFor("/org/ticketing/desks")).toEqual([
      "org.ticketing.tickets",
      "org.ticketing.admin",
    ]);
    expect(requiredPermissionsFor("/org/ticketing/email")).toEqual(["org.ticketing.admin"]);
    expect(requiredPermissionsFor("/org/ticketing/reports")).toEqual(["org.ticketing.reports"]);
    expect(requiredPermissionsFor("/org/ticketing/tickets/9")).toEqual(["org.ticketing.tickets"]);
  });

  it("uses the detail permissions for a single target, and the wider list for the list page", () => {
    expect(requiredPermissionsFor("/org/targets/5")).toEqual([
      "org.targets.view",
      "org.targets.manage",
    ]);
    expect(requiredPermissionsFor("/org/targets")).toContain("org.groups.view");
    expect(requiredPermissionsFor("/org/targets")).toContain("org.users.view");
  });

  it("treats a path with no rule as unrestricted", () => {
    expect(requiredPermissionsFor("/org/unknown-page")).toEqual([]);
  });
});

describe("isOrgRouteDenied", () => {
  it("denies a gated route when the user holds none of its permissions", () => {
    expect(isOrgRouteDenied("/org/roles", [])).toBe(true);
    expect(isOrgRouteDenied("/org/roles", ["org.users.manage"])).toBe(true);
  });

  it("allows a gated route when the user holds any listed permission", () => {
    expect(isOrgRouteDenied("/org/roles", ["org.roles.manage"])).toBe(false);
    expect(isOrgRouteDenied("/org/ticketing/desks", ["org.ticketing.admin"])).toBe(false);
  });

  it("never denies an open route", () => {
    expect(isOrgRouteDenied("/org", [])).toBe(false);
    expect(isOrgRouteDenied("/org/settings/mfa", [])).toBe(false);
  });
});
