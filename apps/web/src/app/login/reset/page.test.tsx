import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "./page";

let search = "";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(async () => ({})),
  ensureCsrf: vi.fn(async () => undefined),
}));

vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    search = "";
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
});
