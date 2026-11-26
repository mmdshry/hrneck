import { describe, expect, it } from "vitest";
import {
  isSsoErrorCode,
  isSsoProvider,
  safeNextPath,
  SSO_ERROR_CODES,
  ssoErrorMessageKey,
  ssoLoginErrorPath,
  ssoStartUrl,
} from "./sso";

describe("isSsoProvider", () => {
  it("accepts only the providers the login page knows", () => {
    expect(isSsoProvider("google")).toBe(true);
    expect(isSsoProvider("microsoft")).toBe(true);
    expect(isSsoProvider("github")).toBe(false);
    expect(isSsoProvider("")).toBe(false);
  });
});

describe("ssoStartUrl", () => {
  it("builds the API redirect path with return_to", () => {
    const url = ssoStartUrl("google", {
      returnTo: "https://itneck.hrneck.test",
      next: null,
      remember: false,
    });
    expect(url).toBe(
      "/api/v1/auth/oauth/google/redirect?return_to=https%3A%2F%2Fitneck.hrneck.test",
    );
  });

  it("adds next and remember only when set", () => {
    const url = ssoStartUrl("microsoft", {
      returnTo: "https://hrneck.test",
      next: "/org/users?page=2",
      remember: true,
    });
    const params = new URL(url, "https://unused.test").searchParams;
    expect(new URL(url, "https://unused.test").pathname).toBe(
      "/api/v1/auth/oauth/microsoft/redirect",
    );
    expect(params.get("next")).toBe("/org/users?page=2");
    expect(params.get("remember")).toBe("1");
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/org/users")).toBe("/org/users");
  });

  it("rejects absolute, protocol-relative and backslash targets", () => {
    expect(safeNextPath("https://evil.test")).toBeNull();
    expect(safeNextPath("//evil.test")).toBeNull();
    expect(safeNextPath("/\\evil.test")).toBeNull();
    expect(safeNextPath("org")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe("sso error codes", () => {
  it("recognises only the codes the API emits", () => {
    for (const code of SSO_ERROR_CODES) {
      expect(isSsoErrorCode(code)).toBe(true);
    }
    expect(isSsoErrorCode("made_up")).toBe(false);
    expect(isSsoErrorCode(null)).toBe(false);
  });

  it("maps every code to a translation key", () => {
    const keys = SSO_ERROR_CODES.map((code) => ssoErrorMessageKey(code));
    expect(new Set(keys).size).toBe(SSO_ERROR_CODES.length);
    expect(ssoErrorMessageKey("not_linked")).toBe("ssoErrorNotLinked");
    expect(ssoErrorMessageKey("handoff_invalid")).toBe("ssoErrorHandoffInvalid");
  });

  it("maps provider_not_configured to its own message key", () => {
    expect(isSsoErrorCode("provider_not_configured")).toBe(true);
    expect(ssoErrorMessageKey("provider_not_configured")).toBe(
      "ssoErrorProviderNotConfigured",
    );
  });

  it("builds a login path with the sso_error parameter", () => {
    expect(ssoLoginErrorPath("account_disabled")).toBe(
      "/login?sso_error=account_disabled",
    );
  });
});
