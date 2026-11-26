import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingDemoForm } from "@/components/landing/landing-demo-form";
import { api } from "@/lib/api";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
});

vi.mock("next-intl", () => {
  const translate = Object.assign(
    (key: string, values?: Record<string, string>) =>
      values?.email ? `${key}:${values.email}` : key,
    { rich: (key: string) => key },
  );
  return { useTranslations: () => translate, useLocale: () => "es" };
});

vi.mock("@/lib/api", () => ({ api: vi.fn() }));

vi.mock("@/components/landing/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => children,
}));

// The real widget loads Cloudflare's script; this stand-in lets the test choose the token.
vi.mock("@/components/landing/turnstile-widget", () => ({
  TurnstileWidget: ({ onTokenChange }: { onTokenChange: (token: string | null) => void }) => (
    <button type="button" onClick={() => onTokenChange("captcha-token")}>
      solve captcha
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("workEmail"), { target: { value: "ada@acme.test" } });
  fireEvent.change(screen.getByLabelText("company"), { target: { value: "Acme MSP" } });
}

describe("LandingDemoForm", () => {
  it("posts the request as JSON and shows an on-page confirmation", async () => {
    vi.mocked(api).mockResolvedValue({ status: "received" });
    render(<LandingDemoForm />);

    fillRequiredFields();
    const submit = screen.getByRole("button", { name: "sendRequest" });
    expect(submit).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "solve captcha" }));
    expect(submit).toHaveProperty("disabled", false);

    fireEvent.click(submit);

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("demoSuccessTitle")).toBeTruthy();
    expect(screen.getByText("demoSuccessBody:ada@acme.test")).toBeTruthy();

    expect(api).toHaveBeenCalledWith(
      "/api/v1/demo-requests",
      expect.objectContaining({ method: "POST" }),
    );
    const init = vi.mocked(api).mock.calls[0][1];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Ada",
      work_email: "ada@acme.test",
      company: "Acme MSP",
      role: "msp",
      message: "",
      locale: "es",
      website: "",
      "cf-turnstile-response": "captcha-token",
    });
  });

  it("shows an error and requires a fresh captcha when the request fails", async () => {
    vi.mocked(api).mockRejectedValue(new Error("Request failed (422)"));
    render(<LandingDemoForm />);

    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "solve captcha" }));
    fireEvent.click(screen.getByRole("button", { name: "sendRequest" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("demoSubmitError:support@hrneck.com");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "sendRequest" })).toHaveProperty("disabled", true);
    });
    expect(screen.getByLabelText("workEmail")).toHaveProperty("value", "ada@acme.test");
  });
});
