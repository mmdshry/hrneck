import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";
import { setTenant } from "@/lib/tenant";
import { SelectOrgClient } from "./select-org-client";

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const apiMock = vi.hoisted(() => vi.fn());
const fetchSessionUserMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const assignMock = vi.hoisted(() => vi.fn());
const searchState = vi.hoisted(() => ({ value: "" }));

// Stable references on purpose: the component's session effect depends on `t` and `router`.
vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(searchState.value),
}));

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ensureCsrf: async () => undefined,
  fetchSessionUser: () => fetchSessionUserMock(),
}));

vi.mock("@/lib/toast", () => ({
  toastError: (message: string) => toastErrorMock(message),
}));

vi.mock("@/lib/tenant", () => ({
  setTenant: vi.fn(),
  tenantWorkspaceUrl: (tenant: string, path: string) => `https://${tenant}.hrneck.test${path}`,
}));

vi.mock("@/lib/webauthn", () => ({
  checkPasskeySupport: () => "unsupported",
  getPasskeyAssertion: vi.fn(),
  isPasskeyCancelled: () => false,
}));

function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 1,
    name: "Ada",
    email: "ada@example.test",
    tenant_id: "itneck",
    roles: ["org_admin"],
    permissions: [],
    has_org_access: true,
    is_platform_staff: false,
    active_tenant_id: "itneck",
    needs_org_selection: true,
    ...overrides,
  };
}

/** A login whose own organization is ITneck, plus a second login of the same email for Company. */
const signedInSession = () =>
  sessionUser({
    memberships: [{ tenant_id: "itneck", name: "ITneck" }],
    organizations: [
      { tenant_id: "itneck", name: "ITneck", requires_password: false },
      { tenant_id: "company", name: "Company", requires_password: true },
    ],
  });

function storeOrgChoice() {
  sessionStorage.setItem(
    "org_choice",
    JSON.stringify({
      challengeToken: "choice-1",
      organizations: [
        { tenant_id: "itneck", name: "ITneck" },
        { tenant_id: "company", name: "Company" },
      ],
    }),
  );
}

describe("SelectOrgClient: org choice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.mockReset();
    fetchSessionUserMock.mockReset();
    searchState.value = "";
    vi.stubGlobal("location", {
      origin: "https://itneck.hrneck.test",
      hostname: "itneck.hrneck.test",
      assign: assignMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("lists the chosen organizations without loading the session", async () => {
    storeOrgChoice();
    render(<SelectOrgClient />);

    expect(await screen.findByText("ITneck")).toBeTruthy();
    expect(screen.getByText("Company")).toBeTruthy();
    expect(fetchSessionUserMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("password")).toBeNull();
  });

  it("signs into the picked organization without a password and opens its subdomain", async () => {
    storeOrgChoice();
    apiMock.mockResolvedValue({
      data: sessionUser({ tenant_id: "company", active_tenant_id: "company", needs_org_selection: false }),
    });
    render(<SelectOrgClient />);

    const buttons = await screen.findAllByRole("button", { name: "selectOrgContinue" });
    fireEvent.click(buttons[1]);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("https://company.hrneck.test/org"));
    expect(apiMock).toHaveBeenCalledWith(
      "/api/v1/auth/login/org",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ challenge_token: "choice-1", tenant: "company" }),
      }),
    );
    expect(setTenant).toHaveBeenCalledWith("company");
    expect(sessionStorage.getItem("org_choice")).toBeNull();
  });

  it("asks for the second factor before opening the organization", async () => {
    storeOrgChoice();
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/auth/login/org") {
        return {
          mfa_required: true,
          challenge_token: "mfa-1",
          mfa_methods: { totp: true, passkey: false },
        };
      }
      if (path === "/api/v1/auth/mfa/verify") {
        return { data: sessionUser({ tenant_id: "company", active_tenant_id: "company", needs_org_selection: false }) };
      }
      return {};
    });
    render(<SelectOrgClient />);

    const buttons = await screen.findAllByRole("button", { name: "selectOrgContinue" });
    fireEvent.click(buttons[1]);

    const code = await screen.findByLabelText("authenticationCode");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.submit(code.closest("form") as HTMLFormElement);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("https://company.hrneck.test/org"));
    expect(apiMock).toHaveBeenCalledWith(
      "/api/v1/auth/mfa/verify",
      expect.objectContaining({
        body: JSON.stringify({ challenge_token: "mfa-1", code: "123456" }),
      }),
    );
  });
});

describe("SelectOrgClient: signed in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.mockReset();
    fetchSessionUserMock.mockReset();
    searchState.value = "";
    vi.stubGlobal("location", {
      origin: "https://itneck.hrneck.test",
      hostname: "itneck.hrneck.test",
      assign: assignMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("opens this login's own organization directly on its subdomain", async () => {
    fetchSessionUserMock.mockResolvedValue(signedInSession());
    apiMock.mockResolvedValue({ data: sessionUser({ needs_org_selection: false }) });
    render(<SelectOrgClient />);

    const buttons = await screen.findAllByRole("button", { name: "selectOrgContinue" });
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("https://itneck.hrneck.test/org"));
    expect(apiMock).toHaveBeenCalledWith("/api/v1/auth/orgs/itneck/enter", { method: "POST" });
    expect(setTenant).toHaveBeenCalledWith("itneck");
  });

  it("asks for another login's password before switching to its organization", async () => {
    fetchSessionUserMock.mockResolvedValue(signedInSession());
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/auth/orgs/company/switch") {
        return { data: sessionUser({ tenant_id: "company", active_tenant_id: "company", needs_org_selection: false }) };
      }
      return {};
    });
    render(<SelectOrgClient />);

    const buttons = await screen.findAllByRole("button", { name: "selectOrgContinue" });
    fireEvent.click(buttons[1]);

    const password = await screen.findByLabelText("password");
    expect(apiMock.mock.calls.some(([path]) => String(path).includes("/switch"))).toBe(false);

    fireEvent.change(password, { target: { value: "their-secret" } });
    fireEvent.submit(password.closest("form") as HTMLFormElement);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("https://company.hrneck.test/org"));
    expect(apiMock).toHaveBeenCalledWith(
      "/api/v1/auth/orgs/company/switch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ password: "their-secret" }),
      }),
    );
  });

  it("goes straight to the only organization when there is one membership", async () => {
    fetchSessionUserMock.mockResolvedValue(
      sessionUser({
        needs_org_selection: false,
        memberships: [{ tenant_id: "itneck", name: "ITneck" }],
        organizations: [{ tenant_id: "itneck", name: "ITneck", requires_password: false }],
      }),
    );
    render(<SelectOrgClient />);

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("https://itneck.hrneck.test/org"));
    expect(screen.queryByRole("button", { name: "selectOrgContinue" })).toBeNull();
  });

  it("sends platform staff to /msp", async () => {
    fetchSessionUserMock.mockResolvedValue(sessionUser({ is_platform_staff: true }));
    render(<SelectOrgClient />);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/msp"));
  });

  it("sends a missing session back to sign-in", async () => {
    fetchSessionUserMock.mockResolvedValue(null);
    render(<SelectOrgClient />);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
  });

  it("shows the failure and stays on the list when entering an organization fails", async () => {
    fetchSessionUserMock.mockResolvedValue(signedInSession());
    apiMock.mockRejectedValue(new Error("Organization is disabled."));
    render(<SelectOrgClient />);

    const buttons = await screen.findAllByRole("button", { name: "selectOrgContinue" });
    fireEvent.click(buttons[0]);

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Organization is disabled."),
    );
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "selectOrgContinue" })).toHaveLength(2);
  });
});
