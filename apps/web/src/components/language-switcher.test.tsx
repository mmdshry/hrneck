import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "./language-switcher";

const refresh = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("@/i18n/set-locale", () => ({
  setLocaleCookie: vi.fn(async () => "es"),
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(async () => ({})),
  ensureCsrf: vi.fn(async () => undefined),
  patchSessionLocale: vi.fn(),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("shows a single closed trigger instead of a flag strip", () => {
    render(<LanguageSwitcher />);
    const trigger = screen.getByRole("button", { name: "label" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
    // Closed: one trigger button only — not six side-by-side locale buttons.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("opens a visual listbox with flag and language labels", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "label" }));
    expect(screen.getByRole("listbox", { name: "label" })).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(6);
    expect(screen.getByRole("option", { name: /Español/i })).toBeTruthy();
  });
});
