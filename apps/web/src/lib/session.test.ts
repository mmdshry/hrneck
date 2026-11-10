import { describe, expect, it } from "vitest";
import {
  canAccessMsp,
  defaultPostLoginPath,
  matchOrgMembership,
  resolvePostLoginPath,
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

  it("treats tenant_id null non-staff like staff enter required", () => {
    expect(
      matchOrgMembership(
        orgUser({ tenant_id: null, is_platform_staff: false }),
        "mmdshry",
      ),
    ).toEqual({
      ok: false,
      kind: "staff_enter_required",
    });
  });
});

describe("MSP staff gate paths", () => {
  it("sends platform staff to /msp by default", () => {
    expect(canAccessMsp(staffUser())).toBe(true);
    expect(defaultPostLoginPath(staffUser())).toBe("/msp");
  });

  it("sends org learners to /org by default", () => {
    const learner = orgUser({
      email: "employee1@mmdshry.com",
      roles: ["learner"],
      permissions: [],
    });
    expect(canAccessMsp(learner)).toBe(false);
    expect(defaultPostLoginPath(learner)).toBe("/org");
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
    expect(resolvePostLoginPath(orgUser(), "/learn")).toBe("/learn");
    expect(resolvePostLoginPath(staffUser(), "/org")).toBe("/org");
  });

  it("ignores unsafe next values", () => {
    expect(resolvePostLoginPath(orgUser(), "//evil.test")).toBe("/org");
    expect(resolvePostLoginPath(orgUser(), "https://evil.test")).toBe("/org");
    expect(resolvePostLoginPath(staffUser(), null)).toBe("/msp");
  });
});
