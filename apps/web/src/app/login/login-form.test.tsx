import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const replace = vi.fn();
const push = vi.fn();
const assign = vi.fn();
const toastErrorMock = vi.fn();
const apiMock = vi.hoisted(() => vi.fn());
let search = "";

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
