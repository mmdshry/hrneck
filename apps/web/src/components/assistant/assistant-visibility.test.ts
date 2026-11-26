import { describe, expect, it } from "vitest";
import { canShowAssistant, type AssistantVisibilityInput } from "./assistant-visibility";

const signedInOrgMember: AssistantVisibilityInput = {
  isOrgRoute: true,
  authChecked: true,
  hasUser: true,
  tenant: "itneck",
  membershipDenied: false,
};

describe("canShowAssistant", () => {
  it("shows the launcher on org pages for a signed-in member", () => {
    expect(canShowAssistant(signedInOrgMember)).toBe(true);
  });

  it("shows the launcher for platform staff acting inside a tenant", () => {
    expect(canShowAssistant({ ...signedInOrgMember, tenant: "company" })).toBe(true);
  });

  it("hides the launcher outside org routes", () => {
    expect(canShowAssistant({ ...signedInOrgMember, isOrgRoute: false })).toBe(false);
  });

  it("hides the launcher until the session has been checked", () => {
    expect(canShowAssistant({ ...signedInOrgMember, authChecked: false })).toBe(false);
  });

  it("hides the launcher without a signed-in user", () => {
    expect(canShowAssistant({ ...signedInOrgMember, hasUser: false })).toBe(false);
  });

  it("hides the launcher until the tenant is resolved", () => {
    expect(canShowAssistant({ ...signedInOrgMember, tenant: "" })).toBe(false);
  });

  it("hides the launcher when the membership gate replaces the page", () => {
    expect(canShowAssistant({ ...signedInOrgMember, membershipDenied: true })).toBe(false);
  });
});
