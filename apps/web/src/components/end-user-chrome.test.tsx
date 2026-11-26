import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";
import {
  TECHNICIAN_PERMISSIONS,
  type EndUserNavItem,
} from "@/lib/end-user-nav";
import { EndUserChrome } from "./end-user-chrome";

const nav = vi.hoisted(() => ({ pathname: "/portal" }));
const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

vi.mock("@/lib/api", () => ({
  ensureCsrf: vi.fn(async () => undefined),
  fetchSessionUser: vi.fn(async () => auth.user),
}));

vi.mock("@/components/brand-mark", () => ({
  BrandMark: () => null,
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => null,
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => null,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

const ITEMS: EndUserNavItem[] = [
  { href: "/portal", label: "My courses", exact: true },
  { href: "/portal/tickets", label: "My tickets" },
  { href: "/portal/kb", label: "Knowledge base" },
  {
    href: "/org/ticketing",
    label: "Technician",
    requiresAnyPermission: TECHNICIAN_PERMISSIONS,
  },
];

function sessionUser(permissions: string[]): SessionUser {
  return {
    id: 3,
    name: "Learner Person",
    email: "learner@itneck.test",
    tenant_id: "itneck",
    roles: ["learner"],
    permissions,
    is_platform_staff: false,
  };
}

function renderChrome() {
  return render(
    <EndUserChrome
      brandHref="/portal/tickets"
      brandLabel="Service portal"
      navLabel="Service portal"
      navItems={ITEMS}
    >
      <p>page body</p>
    </EndUserChrome>,
  );
}

describe("EndUserChrome", () => {
  beforeEach(() => {
    nav.pathname = "/portal";
    auth.user = null;
  });

  it("hides a gated item until the session holds one of its permissions", async () => {
    auth.user = sessionUser([]);
    renderChrome();
    // Avatar initials appear once the session has loaded.
    await screen.findByText("LP");
    expect(screen.getByRole("link", { name: "My tickets" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Technician" })).toBeNull();
  });

  it("shows a gated item when the user holds a matching permission", async () => {
    auth.user = sessionUser(["org.ticketing.tickets"]);
    renderChrome();
    expect(
      await screen.findByRole("link", { name: "Technician" }),
    ).toBeTruthy();
  });

  it("marks the current route and its nested pages as active", () => {
    nav.pathname = "/portal/tickets/42";
    renderChrome();
    expect(
      screen
        .getByRole("link", { name: "My tickets" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Knowledge base" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("keeps the exact dashboard link inactive on nested portal pages", () => {
    nav.pathname = "/portal/tickets/42";
    renderChrome();
    expect(
      screen
        .getByRole("link", { name: "My courses" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("toggles the mobile menu and closes it on Escape, returning focus to the toggle", () => {
    renderChrome();
    const toggle = screen.getByRole("button", { name: "openNavigation" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("end-user-mobile-nav")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("end-user-mobile-nav")).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("end-user-mobile-nav")).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  it("renders page content inside the chrome", () => {
    renderChrome();
    expect(screen.getByText("page body")).toBeTruthy();
  });
});
