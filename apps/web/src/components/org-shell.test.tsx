import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { BookOpen } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/session";
import { OrgShell } from "./org-shell";

const state = vi.hoisted(() => ({
  pathname: "/org",
  user: null as SessionUser | null,
  uploaderProps: [] as Array<{
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    onChanged?: (url: string | null) => void;
  }>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(async () => ({})),
  ensureCsrf: vi.fn(async () => undefined),
  fetchSessionUser: vi.fn(async () => state.user),
  signOut: vi.fn(async () => undefined),
}));

vi.mock("@/lib/tenant", () => ({
  clearTenant: vi.fn(),
  resolveTenant: vi.fn(() => "itneck"),
  setTenant: vi.fn(),
}));

vi.mock("@/components/assistant/assistant-panel", () => ({
  AssistantPanel: () => null,
}));

vi.mock("@/components/assistant/assistant-visibility", () => ({
  canShowAssistant: () => false,
}));

vi.mock("@/components/brand-mark", () => ({
  BrandMark: () => null,
}));

vi.mock("@/components/org-membership-gate", () => ({
  OrgMembershipGate: () => null,
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => null,
}));

vi.mock("@/components/subscription-notice", () => ({
  SubscriptionNotice: () => null,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/components/ui/avatar-uploader", () => ({
  AvatarUploader: (props: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    onChanged?: (url: string | null) => void;
  }) => {
    state.uploaderProps.push(props);
    return null;
  },
}));

function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 7,
    name: "Ada Lovelace",
    email: "ada@itneck.test",
    tenant_id: "itneck",
    department: "Finance",
    roles: ["learner", "org_admin"],
    permissions: [],
    is_platform_staff: false,
    avatar_url: null,
    ...overrides,
  };
}

function renderShell() {
  return render(
    <OrgShell>
      <p>page body</p>
    </OrgShell>,
  );
}

function lastUploaderProps() {
  return state.uploaderProps[state.uploaderProps.length - 1];
}

async function findSidebar() {
  return screen.findByRole("complementary", { name: "Sidebar" });
}

function expectFooterExtraBelowTheme(container: HTMLElement) {
  const theme = within(container).getByText("Theme");
  const extra = within(container).getByText("Extra footer row");
  expect(theme.compareDocumentPosition(extra) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("OrgShell profile block", () => {
  beforeEach(() => {
    state.pathname = "/org";
    state.user = null;
    state.uploaderProps.length = 0;
  });

  it("shows the avatar, name, email and role line at the top of the sidebar", async () => {
    state.user = sessionUser();
    renderShell();

    const sidebar = await findSidebar();
    await within(sidebar).findByText("Ada Lovelace");

    expect(within(sidebar).getByText("org_admin . Finance")).toBeTruthy();
    expect(within(sidebar).getAllByText("ada@itneck.test")).toHaveLength(1);
    expect(lastUploaderProps()?.name).toBe("Ada Lovelace");
    expect(lastUploaderProps()?.email).toBe("ada@itneck.test");
  });

  it("uses the email as display name and does not repeat it when the name is empty", async () => {
    state.user = sessionUser({ name: "" });
    renderShell();

    const sidebar = await findSidebar();
    await within(sidebar).findByText("ada@itneck.test");

    expect(within(sidebar).getAllByText("ada@itneck.test")).toHaveLength(1);
  });

  it("falls back to job title and target department when the user has no operator role", async () => {
    state.user = sessionUser({
      roles: ["learner"],
      job_title: "Analyst",
      target_department: "Sales",
    });
    renderShell();

    const sidebar = await findSidebar();
    expect(await within(sidebar).findByText("Analyst . Sales")).toBeTruthy();
    expect(within(sidebar).queryByText("Finance")).toBeNull();
  });

  it("shows the same profile block in the mobile navigation drawer", async () => {
    state.user = sessionUser();
    renderShell();

    await within(await findSidebar()).findByText("Ada Lovelace");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    const drawer = document.getElementById("org-mobile-nav");
    expect(drawer).not.toBeNull();
    expect(within(drawer!).getByText("Ada Lovelace")).toBeTruthy();
    expect(within(drawer!).getByText("org_admin . Finance")).toBeTruthy();
  });

  it("feeds a changed avatar back into the session user", async () => {
    state.user = sessionUser();
    renderShell();

    await within(await findSidebar()).findByText("Ada Lovelace");
    act(() => {
      lastUploaderProps()?.onChanged?.("/api/v1/auth/avatar?v=2");
    });

    expect(lastUploaderProps()?.avatarUrl).toBe("/api/v1/auth/avatar?v=2");
  });
});

describe("OrgShell route permission gate", () => {
  beforeEach(() => {
    state.pathname = "/org";
    state.user = null;
    state.uploaderProps.length = 0;
  });

  it("shows the no-access page instead of the page body when the member lacks the route permission", async () => {
    state.pathname = "/org/roles";
    state.user = sessionUser({ permissions: ["org.users.view"] });
    renderShell();

    expect(await screen.findByText("orgNoAccess.title")).toBeTruthy();
    expect(screen.queryByText("page body")).toBeNull();
    const backLink = screen.getByRole("link", { name: "orgNoAccess.backToDashboard" });
    expect(backLink.getAttribute("href")).toBe("/org");
  });

  it("renders the page when the member holds a permission for the route", async () => {
    state.pathname = "/org/roles";
    state.user = sessionUser({ permissions: ["org.roles.manage"] });
    renderShell();

    expect(await screen.findByText("page body")).toBeTruthy();
    expect(screen.queryByText("orgNoAccess.title")).toBeNull();
  });

  it("does not gate open routes such as the per-account MFA page", async () => {
    state.pathname = "/org/settings/mfa";
    state.user = sessionUser({ permissions: [] });
    renderShell();

    expect(await screen.findByText("page body")).toBeTruthy();
    expect(screen.queryByText("orgNoAccess.title")).toBeNull();
  });
});

describe("OrgShell navigation", () => {
  beforeEach(() => {
    state.user = null;
    state.uploaderProps.length = 0;
  });

  it("shows the organization console menu by default, filtered by permission", async () => {
    state.user = sessionUser({ permissions: ["org.ticketing.tickets"] });
    renderShell();

    const sidebar = await findSidebar();
    await within(sidebar).findByText("Ada Lovelace");
    expect(within(sidebar).getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(within(sidebar).getByRole("link", { name: "Ticketing" })).toBeTruthy();
    expect(within(sidebar).queryByRole("link", { name: "Training" })).toBeNull();
  });

  it("renders the menu and footer extras supplied by the caller", async () => {
    state.user = sessionUser();
    render(
      <OrgShell
        resolveNavItems={() => [{ href: "/portal", label: "Custom item", icon: BookOpen }]}
        footerExtras={<p>Extra footer row</p>}
      >
        <p>page body</p>
      </OrgShell>,
    );

    const sidebar = await findSidebar();
    await within(sidebar).findByText("Ada Lovelace");
    expect(within(sidebar).getByRole("link", { name: "Custom item" })).toBeTruthy();
    expect(within(sidebar).queryByRole("link", { name: "Dashboard" })).toBeNull();
    expectFooterExtraBelowTheme(sidebar);

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const drawer = document.getElementById("org-mobile-nav");
    expect(drawer).not.toBeNull();
    expectFooterExtraBelowTheme(drawer!);
  });
});
