import { describe, expect, it } from "vitest";
import {
  canAccessMsp,
  defaultPostLoginPath,
  hasPermission,
  matchOrgMembership,
  resolvePostLoginPath,
  signInOrganizations,
  type SessionUser,
} from "./session";

function orgUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 1,
    name: "Org Admin",
    email: "admin@itneck.test",
    tenant_id: "itneck",
    roles: ["org_admin"],
    permissions: ["org.training.manage"],
    has_org_access: true,
    is_platform_staff: false,
    ...overrides,
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

describe("matchOrgMembership", () => {
  it("allows an org user in their own tenant", () => {
    expect(matchOrgMembership(orgUser(), "itneck")).toEqual({ ok: true });
  });

  it("rejects an org user on another tenant", () => {
    expect(matchOrgMembership(orgUser(), "mmdshry")).toEqual({
      ok: false,
      kind: "org_mismatch",
      homeTenant: "itneck",
    });
  });

  it("allows platform staff who entered the current tenant", () => {
    expect(
      matchOrgMembership(
        staffUser({ staff_tenant_id: "mmdshry", acting_in_tenant: true }),
        "mmdshry",
      ),
    ).toEqual({ ok: true });
  });

  it("rejects platform staff who have not entered a tenant", () => {
    expect(matchOrgMembership(staffUser(), "mmdshry")).toEqual({
      ok: false,
      kind: "staff_enter_required",
    });
  });

  it("rejects platform staff who entered a different tenant", () => {
    expect(
      matchOrgMembership(
        staffUser({ staff_tenant_id: "itneck", acting_in_tenant: true }),
        "mmdshry",
      ),
    ).toEqual({
      ok: false,
      kind: "staff_enter_required",
    });
  });

  it("asks multi-membership users to select an org when tenant is unknown", () => {
    expect(
      matchOrgMembership(
        orgUser({
          tenant_id: null,
          memberships: [
            { tenant_id: "itneck", name: "ITneck" },
            { tenant_id: "company", name: "Company" },
          ],
        }),
        "mmdshry",
      ),
    ).toEqual({
      ok: false,
      kind: "org_selection_required",
    });
  });

  it("allows a membership match even when active tenant_id differs", () => {
    expect(
      matchOrgMembership(
        orgUser({
          tenant_id: "itneck",
          memberships: [
            { tenant_id: "itneck", name: "ITneck" },
            { tenant_id: "company", name: "Company" },
          ],
        }),
        "company",
      ),
    ).toEqual({ ok: true });
  });
});

describe("hasPermission for staff tenant context", () => {
  it("platform agent acting in tenant sees only the API-provided support permissions", () => {
    const agent = staffUser({
      staff_tenant_id: "itneck",
      acting_in_tenant: true,
      permissions: ["org.targets.manage"],
    });
    expect(hasPermission(agent, "org.targets.manage")).toBe(true);
    expect(hasPermission(agent, "org.settings.manage")).toBe(false);
    expect(hasPermission(agent, "org.roles.manage")).toBe(false);
  });

  it("platform super admin acting in tenant gets roles and settings", () => {
    const superAdmin = staffUser({
      staff_tenant_id: "itneck",
      acting_in_tenant: true,
      permissions: ["org.roles.manage", "org.settings.manage"],
    });
    expect(hasPermission(superAdmin, "org.roles.manage")).toBe(true);
    expect(hasPermission(superAdmin, "org.settings.manage")).toBe(true);
  });

  it("gives staff outside a tenant no org permissions", () => {
    expect(hasPermission(staffUser(), "org.roles.manage")).toBe(false);
  });
});

describe("MSP staff gate paths", () => {
  it("sends platform staff to /msp by default", () => {
    expect(canAccessMsp(staffUser())).toBe(true);
    expect(defaultPostLoginPath(staffUser())).toBe("/msp");
  });

  it("sends org admins with console access to /org by default", () => {
    expect(defaultPostLoginPath(orgUser({ has_org_access: true }))).toBe("/org");
  });

  it("sends employees without console access to the /portal dashboard by default", () => {
    const learner = orgUser({
      email: "employee1@mmdshry.com",
      roles: ["learner"],
      permissions: ["org.ticketing.portal"],
      has_org_access: false,
      memberships: [{ tenant_id: "mmdshry", name: "mmdshry" }],
    });
    expect(canAccessMsp(learner)).toBe(false);
    expect(defaultPostLoginPath(learner)).toBe("/portal");
  });

  it("keeps /select-org ahead of the employee dashboard for multi-org employees", () => {
    const multi = orgUser({
      has_org_access: false,
      needs_org_selection: true,
      memberships: [
        { tenant_id: "itneck", name: "ITneck" },
        { tenant_id: "company", name: "Company" },
      ],
    });
    expect(defaultPostLoginPath(multi)).toBe("/select-org");
  });

  it("sends multi-membership users to /select-org", () => {
    const multi = orgUser({
      needs_org_selection: true,
      memberships: [
        { tenant_id: "itneck", name: "ITneck" },
        { tenant_id: "company", name: "Company" },
      ],
    });
    expect(defaultPostLoginPath(multi)).toBe("/select-org");
    expect(resolvePostLoginPath(multi, "/org/users")).toBe(
      "/select-org?next=%2Forg%2Fusers",
    );
  });

  it("does not loop multi-membership users back to /select-org after enter", () => {
    const selected = orgUser({
      tenant_id: "company",
      needs_org_selection: false,
      memberships: [
        { tenant_id: "itneck", name: "ITneck" },
        { tenant_id: "company", name: "Company" },
      ],
    });
    expect(defaultPostLoginPath(selected)).toBe("/org");
    expect(resolvePostLoginPath(selected, "/portal")).toBe("/portal");
  });

  it("sends null-tenant non-staff to /org, not /msp", () => {
    const orphan = orgUser({ tenant_id: null, is_platform_staff: false });
    expect(canAccessMsp(orphan)).toBe(false);
    expect(defaultPostLoginPath(orphan)).toBe("/org");
  });

  it("rejects next=/msp for non-staff", () => {
    expect(resolvePostLoginPath(orgUser(), "/msp")).toBe("/org");
    expect(resolvePostLoginPath(orgUser(), "/msp/tenants")).toBe("/org");
  });

  it("keeps next=/msp for platform staff", () => {
    expect(resolvePostLoginPath(staffUser(), "/msp")).toBe("/msp");
    expect(resolvePostLoginPath(staffUser(), "/msp/tenants")).toBe("/msp/tenants");
  });

  it("keeps non-msp next paths for everyone", () => {
    expect(resolvePostLoginPath(orgUser(), "/org")).toBe("/org");
    expect(resolvePostLoginPath(orgUser(), "/portal/tickets")).toBe("/portal/tickets");
    expect(resolvePostLoginPath(staffUser(), "/org")).toBe("/org");
  });

  it("ignores unsafe next values", () => {
    expect(resolvePostLoginPath(orgUser(), "//evil.test")).toBe("/org");
    expect(resolvePostLoginPath(orgUser(), "https://evil.test")).toBe("/org");
    expect(resolvePostLoginPath(staffUser(), null)).toBe("/msp");
  });
});

describe("sign-in organizations", () => {
  const ownAndSibling = orgUser({
    tenant_id: "itneck",
    needs_org_selection: true,
    memberships: [{ tenant_id: "itneck", name: "ITneck" }],
    organizations: [
      { tenant_id: "itneck", name: "ITneck", requires_password: false },
      { tenant_id: "company", name: "Company", requires_password: true },
    ],
  });

  it("lists this login's organizations first, then other logins of the same email", () => {
    expect(
      signInOrganizations(ownAndSibling).map((org) => [org.tenant_id, org.requires_password]),
    ).toEqual([
      ["itneck", false],
      ["company", true],
    ]);
  });

  it("falls back to memberships when the API sent no organization list", () => {
    const legacy = orgUser({
      memberships: [
        { tenant_id: "itneck", name: "ITneck" },
        { tenant_id: "company", name: "Company" },
      ],
    });
    expect(signInOrganizations(legacy)).toEqual([
      { tenant_id: "itneck", name: "ITneck", requires_password: false },
      { tenant_id: "company", name: "Company", requires_password: false },
    ]);
  });

  it("keeps this login's own organization accessible", () => {
    expect(matchOrgMembership(ownAndSibling, "itneck")).toEqual({ ok: true });
  });

  it("asks for org selection when the tenant is only another login of the same email", () => {
    expect(matchOrgMembership(ownAndSibling, "company")).toEqual({
      ok: false,
      kind: "org_selection_required",
    });
  });
});
