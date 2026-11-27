import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";

const apiMock = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ message: "sent" })),
);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ensureCsrf: vi.fn(async () => undefined),
}));

vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

function setHostname(hostname: string): void {
  vi.stubGlobal("location", { hostname, origin: `https://${hostname}` });
}

/** The JSON body of the forgot-password request. */
function sentForgotBody(): Record<string, unknown> | null {
  const call = apiMock.mock.calls.find(([path]) => path === "/api/v1/auth/password/forgot");
  const init = call?.[1] as { body?: string } | undefined;
  return init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
}

async function submitEmail(email: string): Promise<void> {
  fireEvent.change(screen.getByLabelText("email"), { target: { value: email } });
  fireEvent.submit(screen.getByLabelText("email").closest("form") as HTMLFormElement);
  await waitFor(() => expect(sentForgotBody()).not.toBeNull());
}

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("asks for a reset for the organization of the tenant host", async () => {
    setHostname("itneck.hrneck.test");
    render(<ForgotPasswordPage />);

    await submitEmail("ana@itneck.test");
    expect(sentForgotBody()).toEqual({ email: "ana@itneck.test", tenant: "itneck" });
  });

  it("asks for a reset of a platform account on the staff host", async () => {
    setHostname("app.hrneck.test");
    render(<ForgotPasswordPage />);

    await submitEmail("root@hrneck.test");
    expect(sentForgotBody()).toEqual({ email: "root@hrneck.test", scope: "platform" });
  });
});
