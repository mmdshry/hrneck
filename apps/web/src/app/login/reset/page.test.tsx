import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./page";

let search = "";
const apiMock = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({})),
);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ensureCsrf: vi.fn(async () => undefined),
}));

vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
}));

function setHostname(hostname: string): void {
  vi.stubGlobal("location", { hostname, origin: `https://${hostname}` });
}

/** The JSON body of the reset request. */
function sentResetBody(): Record<string, unknown> | null {
  const call = apiMock.mock.calls.find(([path]) => path === "/api/v1/auth/password/reset");
  const init = call?.[1] as { body?: string } | undefined;
  return init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
}

async function submitReset(): Promise<void> {
  fireEvent.change(screen.getByLabelText("newPassword"), { target: { value: "new-secret-1" } });
  fireEvent.change(screen.getByLabelText("confirmPassword"), { target: { value: "new-secret-1" } });
  fireEvent.submit(screen.getByRole("button", { name: "resetPassword" }).closest("form") as HTMLFormElement);
  await waitFor(() => expect(sentResetBody()).not.toBeNull());
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    search = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses set-password copy for employee invite links", async () => {
    search = "token=abc&email=ana%40itneck.test&invite=1";
    render(<ResetPasswordPage />);

    expect(await screen.findByRole("heading", { name: "inviteTitle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "inviteSubmit" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "resetTitle" })).toBeNull();
  });

  it("keeps the reset copy for regular reset links", async () => {
    search = "token=abc&email=ana%40itneck.test";
    render(<ResetPasswordPage />);

    expect(await screen.findByRole("heading", { name: "resetTitle" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "resetPassword" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "inviteTitle" })).toBeNull();
  });

  it("resets for the organization of the tenant host", async () => {
    setHostname("itneck.hrneck.test");
    search = "token=abc&email=ana%40itneck.test";
    render(<ResetPasswordPage />);

    await submitReset();
    expect(sentResetBody()).toMatchObject({ token: "abc", email: "ana@itneck.test", tenant: "itneck" });
    expect(sentResetBody()).not.toHaveProperty("scope");
  });

  it("resets a platform account with scope platform on the staff host", async () => {
    setHostname("app.hrneck.test");
    search = "token=abc&email=root%40hrneck.test";
    render(<ResetPasswordPage />);

    await submitReset();
    expect(sentResetBody()).toMatchObject({ token: "abc", scope: "platform" });
    expect(sentResetBody()).not.toHaveProperty("tenant");
  });

  it("keeps working for older links that name the organization in ?tenant=", async () => {
    setHostname("hrneck.test");
    search = "token=abc&email=ana%40company.test&tenant=company";
    render(<ResetPasswordPage />);

    await submitReset();
    expect(sentResetBody()).toMatchObject({ tenant: "company" });
  });
});
