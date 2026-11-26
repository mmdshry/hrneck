import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { setTenant } from "@/lib/tenant";
import SsoCompletePage from "./page";

const replace = vi.fn();
let search = "";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  ensureCsrf: vi.fn(async () => undefined),
}));

vi.mock("@/lib/tenant", () => ({
  setTenant: vi.fn(),
}));

vi.mock("@/i18n/set-locale", () => ({
  setLocaleCookie: vi.fn(async () => "en"),
}));

const orgUser = {
  email: "ana@itneck.test",
  tenant_id: "itneck",
  is_platform_staff: false,
  has_org_access: true,
  needs_org_selection: false,
  memberships: [{ tenant_id: "itneck", name: "ITneck" }],
};

describe("SSO handoff page", () => {
  beforeEach(() => {
    search = "";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends the user back to login when the token is missing", async () => {
    render(<SsoCompletePage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?sso_error=handoff_invalid");
    });
    expect(api).not.toHaveBeenCalled();
  });

  it("exchanges the token once and continues to the org area", async () => {
    search = "token=abc123";
    vi.mocked(api).mockResolvedValueOnce({ data: orgUser, next: null });

    render(
      <StrictMode>
        <SsoCompletePage />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/org");
    });
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith(
      "/api/v1/auth/oauth/exchange",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "abc123" }),
      }),
    );
    expect(setTenant).toHaveBeenCalledWith("itneck");
  });

  it("returns to login with handoff_invalid when the exchange fails", async () => {
    search = "token=stale";
    vi.mocked(api).mockRejectedValueOnce(new Error("This sign-in link has expired."));

    render(<SsoCompletePage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?sso_error=handoff_invalid");
    });
    expect(setTenant).not.toHaveBeenCalled();
  });
});
