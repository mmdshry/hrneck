import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const replace = vi.fn();
const push = vi.fn();
const assign = vi.fn();
const toastErrorMock = vi.fn();
const apiMock = vi.hoisted(() => vi.fn());
let search = "";
let hostTenant: string | null = null;

const PROVIDERS_PATH = "/api/v1/auth/oauth/providers";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/toast", () => ({
  toastError: (message: string) => toastErrorMock(message),
}));

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ensureCsrf: vi.fn(async () => undefined),
}));

vi.mock("@/lib/tenant", () => ({
  setTenant: vi.fn(),
  tenantFromHostname: () => hostTenant,
}));

vi.mock("@/i18n/set-locale", () => ({
  setLocaleCookie: vi.fn(async () => "en"),
}));

function respondWithProviders(data: string[]) {
  apiMock.mockImplementation(async (path: string) => {
    if (path === PROVIDERS_PATH) {
      return { data };
    }
    return {};
  });
}

/** Lets the providers request resolve and its state update commit. */
async function flushRequests() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
}

describe("LoginForm SSO", () => {
  beforeEach(() => {
    search = "";
    respondWithProviders(["google", "microsoft"]);
    vi.stubGlobal("location", {
      origin: "https://itneck.hrneck.test",
      assign,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("offers Google and Microsoft next to the password form when both are configured", async () => {
    render(<LoginForm />);

    expect(await screen.findByRole("button", { name: "continueWithGoogle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "continueWithMicrosoft" })).toBeTruthy();
    expect(screen.getByLabelText("password")).toBeTruthy();
  });

  it("shows each provider logo to the left of its label", async () => {
    render(<LoginForm />);

    const google = await screen.findByRole("button", { name: "continueWithGoogle" });
    const microsoft = screen.getByRole("button", { name: "continueWithMicrosoft" });

    for (const button of [google, microsoft]) {
      expect(button.firstElementChild?.localName).toBe("svg");
      expect(button.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    }
    // The logos carry no text, so the visible label is still just the translation key.
    expect(google.textContent).toBe("continueWithGoogle");
    expect(microsoft.textContent).toBe("continueWithMicrosoft");
  });

  it("asks the API which providers are configured", async () => {
    render(<LoginForm />);
    await screen.findByRole("button", { name: "continueWithGoogle" });

    expect(apiMock).toHaveBeenCalledWith(PROVIDERS_PATH);
  });

  it("hides the SSO buttons and divider when no provider is configured", async () => {
    respondWithProviders([]);
    render(<LoginForm />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(PROVIDERS_PATH));
    await flushRequests();

    expect(screen.queryByRole("button", { name: "continueWithGoogle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "continueWithMicrosoft" })).toBeNull();
    expect(screen.queryByText("orSignInWithPassword")).toBeNull();
    expect(screen.getByLabelText("password")).toBeTruthy();
  });

  it("shows only the providers the API reports and ignores unknown names", async () => {
    respondWithProviders(["microsoft", "github"]);
    render(<LoginForm />);

    expect(await screen.findByRole("button", { name: "continueWithMicrosoft" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "continueWithGoogle" })).toBeNull();
  });

  it("keeps password sign-in when the provider list cannot be loaded", async () => {
    apiMock.mockRejectedValue(new Error("network down"));
    render(<LoginForm />);
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(PROVIDERS_PATH));
    await flushRequests();

    expect(screen.queryByRole("button", { name: "continueWithGoogle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "continueWithMicrosoft" })).toBeNull();
    expect(screen.getByLabelText("password")).toBeTruthy();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("starts Google sign-in with the page origin and the safe next path", async () => {
    search = "next=%2Forg%2Fusers";
    render(<LoginForm />);

    fireEvent.click(await screen.findByRole("button", { name: "continueWithGoogle" }));

    expect(assign).toHaveBeenCalledWith(
      "/api/v1/auth/oauth/google/redirect?return_to=https%3A%2F%2Fitneck.hrneck.test&next=%2Forg%2Fusers",
    );
  });

  it("forwards the remember-me choice to Microsoft sign-in", async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(await screen.findByRole("button", { name: "continueWithMicrosoft" }));

    expect(assign).toHaveBeenCalledWith(
      "/api/v1/auth/oauth/microsoft/redirect?return_to=https%3A%2F%2Fitneck.hrneck.test&remember=1",
    );
  });

  it("drops an unsafe next value before starting SSO", async () => {
    search = "next=%2F%2Fevil.test";
    render(<LoginForm />);

    fireEvent.click(await screen.findByRole("button", { name: "continueWithGoogle" }));

    expect(assign).toHaveBeenCalledWith(
      "/api/v1/auth/oauth/google/redirect?return_to=https%3A%2F%2Fitneck.hrneck.test",
    );
  });

  it("shows a known sso_error once and removes it from the URL", async () => {
    search = "sso_error=not_linked&next=%2Forg";
    render(<LoginForm />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("ssoErrorNotLinked");
    });
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Forg");
  });

  it("maps provider_not_configured to its own message", async () => {
    search = "sso_error=provider_not_configured";
    render(<LoginForm />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("ssoErrorProviderNotConfigured");
    });
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("ignores an sso_error code it does not know", async () => {
    search = "sso_error=made_up";
    render(<LoginForm />);
    await screen.findByRole("button", { name: "continueWithGoogle" });

    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

/** The JSON body of the most recent login request. */
function sentLoginBody(): Record<string, unknown> | null {
  const call = apiMock.mock.calls.find(([path]) => path === "/api/v1/auth/login");
  const init = call?.[1] as { body?: string } | undefined;
  return init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
}

describe("LoginForm on the staff host", () => {
  beforeEach(() => {
    search = "";
    hostTenant = null;
    apiMock.mockImplementation(async (path: string) => {
      if (path === PROVIDERS_PATH) {
        return { data: ["google", "microsoft"] };
      }
      return {
        data: {
          email: "root@example.test",
          tenant_id: null,
          needs_org_selection: false,
          has_org_access: false,
          is_platform_staff: true,
          memberships: [],
        },
      };
    });
    vi.stubGlobal("location", {
      origin: "https://app.hrneck.test",
      hostname: "app.hrneck.test",
      assign,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("offers password sign-in only and does not ask for the provider list", async () => {
    render(<LoginForm scope="platform" />);
    await flushRequests();

    expect(apiMock).not.toHaveBeenCalledWith(PROVIDERS_PATH);
    expect(screen.queryByRole("button", { name: "continueWithGoogle" })).toBeNull();
    expect(screen.queryByRole("button", { name: "continueWithMicrosoft" })).toBeNull();
    expect(screen.getByLabelText("password")).toBeTruthy();
  });

  it("signs in with scope platform and sends no organization", async () => {
    render(<LoginForm scope="platform" />);
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "root@example.test" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "staff-password" } });
    fireEvent.submit(screen.getByLabelText("email").closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(sentLoginBody()).toEqual({
        email: "root@example.test",
        password: "staff-password",
        remember: false,
        scope: "platform",
      }),
    );
  });
});

describe("LoginForm organization scope", () => {
  beforeEach(() => {
    search = "tenant=company";
    hostTenant = null;
    apiMock.mockImplementation(async (path: string) => {
      if (path === PROVIDERS_PATH) {
        return { data: [] };
      }
      return {
        data: {
          email: "ada@example.test",
          tenant_id: "itneck",
          needs_org_selection: false,
          has_org_access: true,
          is_platform_staff: false,
          memberships: [{ tenant_id: "itneck", name: "ITneck" }],
        },
      };
    });
    vi.stubGlobal("location", {
      origin: "https://hrneck.test",
      hostname: "hrneck.test",
      assign,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("ignores a ?tenant= query and sends no organization when the host is not one", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "shared-password" } });
    fireEvent.submit(screen.getByLabelText("email").closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(sentLoginBody()).toEqual({
        email: "ada@example.test",
        password: "shared-password",
        remember: false,
        scope: "tenant",
      }),
    );
    expect(sentLoginBody()).not.toHaveProperty("tenant");
  });
});

describe("LoginForm organization choice", () => {
  const organizations = [
    { tenant_id: "itneck", name: "ITneck" },
    { tenant_id: "company", name: "Company" },
  ];

  beforeEach(() => {
    search = "";
    apiMock.mockImplementation(async (path: string) => {
      if (path === PROVIDERS_PATH) {
        return { data: [] };
      }
      return {
        org_choice_required: true,
        challenge_token: "choice-1",
        organizations,
      };
    });
    vi.stubGlobal("location", {
      origin: "https://hrneck.test",
      hostname: "hrneck.test",
      assign,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  async function submitCredentials() {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "shared-password" } });
    fireEvent.submit(screen.getByLabelText("email").closest("form") as HTMLFormElement);
  }

  it("opens /select-org with the challenge when one password matches several organizations", async () => {
    await submitCredentials();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/select-org"));
    expect(JSON.parse(sessionStorage.getItem("org_choice") ?? "null")).toEqual({
      challengeToken: "choice-1",
      organizations,
    });
    expect(sessionStorage.getItem("mfa_challenge")).toBeNull();
  });

  it("keeps the safe next path when it sends the user to /select-org", async () => {
    search = "next=%2Forg%2Fusers";
    await submitCredentials();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/select-org?next=%2Forg%2Fusers"),
    );
  });
});

describe("LoginForm organization address", () => {
  beforeEach(() => {
    search = "";
    hostTenant = "company";
    apiMock.mockImplementation(async (path: string) => {
      if (path === PROVIDERS_PATH) {
        return { data: [] };
      }
      return {
        data: {
          email: "ada@example.test",
          tenant_id: "company",
          needs_org_selection: false,
          has_org_access: true,
          is_platform_staff: false,
          memberships: [{ tenant_id: "company", name: "Company" }],
        },
      };
    });
    vi.stubGlobal("location", {
      origin: "https://company.hrneck.test",
      hostname: "company.hrneck.test",
      assign,
    });
  });

  afterEach(() => {
    hostTenant = null;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends the organization address with the password and opens that organization", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("email"), { target: { value: "ada@example.test" } });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "shared-password" } });
    fireEvent.submit(screen.getByLabelText("email").closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "/api/v1/auth/login",
        expect.objectContaining({ body: expect.stringContaining('"tenant":"company"') }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/org"));
  });
});
