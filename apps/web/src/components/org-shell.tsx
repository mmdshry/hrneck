"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  Download,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  Settings2,
  Target,
  Ticket,
  GraduationCap,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrandMark } from "@/components/brand-mark";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import { clearTenant, resolveTenant, setTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: string;
  platformOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/org", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/msp", label: "Organizations", icon: Building2, exact: true, platformOnly: true },
  { href: "/org/training", label: "Training", icon: GraduationCap, permission: "org.training.manage" },
  { href: "/org/checklists", label: "Checklists", icon: ClipboardList, permission: "org.checklists.manage" },
  { href: "/org/ticketing", label: "Ticketing", icon: Ticket, permission: "org.ticketing.tickets" },
  { href: "/org/targets", label: "Targets & Groups", icon: Target, permission: "org.targets.manage" },
  { href: "/org/users", label: "Users", icon: Users, permission: "org.users.manage" },
  { href: "/org/roles", label: "Roles", icon: KeyRound, permission: "org.roles.manage" },
  { href: "/org/reports", label: "Reporting", icon: BarChart3, permission: "org.reports.view" },
  { href: "/org/reports/export", label: "Export", icon: Download, permission: "org.reports.export" },
  { href: "/org/announcements", label: "Announcements", icon: Megaphone, permission: "org.announcements.manage" },
  { href: "/org/settings", label: "Settings", icon: Settings2, permission: "org.settings.manage" },
  { href: "/docs", label: "Guides", icon: BookOpen },
];

function visibleNav(user: SessionUser | null): NavItem[] {
  return NAV.filter((item) => {
    if (item.platformOnly) {
      return Boolean(user?.is_platform_staff);
    }
    if (!item.permission) {
      return true;
    }
    if (!user) {
      return false;
    }
    return user.permissions.includes(item.permission);
  });
}

function matchesPath(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Only the longest matching href is active — avoids parent+child both highlighted. */
function isNavActive(pathname: string, item: NavItem, items: NavItem[] = NAV): boolean {
  const hits = items.filter((candidate) => matchesPath(pathname, candidate));
  if (hits.length === 0) {
    return false;
  }
  const best = hits.reduce((a, b) => (a.href.length >= b.href.length ? a : b));
  return best.href === item.href;
}

function NavLinks({
  pathname,
  items,
  onNavigate,
  labelledBy,
}: {
  pathname: string;
  items: NavItem[];
  onNavigate?: () => void;
  labelledBy?: string;
}) {
  return (
    <nav
      className="flex flex-1 flex-col space-y-0.5"
      aria-label={labelledBy ? undefined : "Organization"}
      aria-labelledby={labelledBy}
    >
      {items.map((item) => {
        const active = isNavActive(pathname, item, items);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors duration-[var(--motion)]",
              active
                ? "bg-[var(--accent)] font-medium text-[var(--accent-foreground)] shadow-[var(--shadow-sm)]"
                : "text-[var(--foreground)] hover:bg-[var(--muted)]",
            )}
          >
            <Icon
              className="h-4 w-4 shrink-0 opacity-90"
              strokeWidth={active ? 2.25 : 1.75}
              aria-hidden
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AuthFooter({
  authChecked,
  userEmail,
  signingOut,
  onSignOut,
  onNavigate,
}: {
  authChecked: boolean;
  userEmail: string | null;
  signingOut: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="mt-4 space-y-2 border-t border-[var(--border)] px-2 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Theme
        </p>
        <ThemeToggle />
      </div>
      {authChecked && userEmail ? (
        <>
          <p
            className="truncate text-xs text-[var(--muted-foreground)]"
            title={userEmail}
          >
            {userEmail}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start px-3"
            onClick={onSignOut}
            disabled={signingOut}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </>
      ) : (
        <Link
          href="/login"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          <LogIn className="h-4 w-4 shrink-0" aria-hidden />
          Sign in
        </Link>
      )}
    </div>
  );
}

export function OrgShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const tenant = resolveTenant();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navPathname, setNavPathname] = useState(pathname);
  const drawerTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const navItems = visibleNav(user);

  if (navPathname !== pathname) {
    setNavPathname(pathname);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  useEffect(() => {
    void fetchSessionUser().then((sessionUser) => {
      setUser(sessionUser);
      setUserEmail(sessionUser?.email ?? null);
      setAuthChecked(true);
      if (sessionUser?.tenant_id) {
        setTenant(sessionUser.tenant_id);
      }
    });
  }, [pathname]);

  useEffect(() => {
    if (!authChecked || user) {
      return;
    }
    // Guides stay public; MSP/org require a session (API already enforces this).
    if (pathname === "/docs" || pathname.startsWith("/docs/")) {
      return;
    }
    const next = encodeURIComponent(pathname || "/org");
    window.location.replace(`/login?next=${next}`);
  }, [authChecked, user, pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  async function signOut() {
    setSigningOut(true);
    try {
      await ensureCsrf();
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      /* already signed out */
    } finally {
      setUser(null);
      setUserEmail(null);
      clearTenant();
      setSigningOut(false);
      setMobileOpen(false);
      window.location.replace("/login");
    }
  }

  const brandBlock = (
    <div className="px-2">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {tenant}
      </p>
      <div className="mt-1">
        <BrandMark size="md" nameClassName="text-xl" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1">
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] px-3 py-6 md:flex"
        aria-label="Sidebar"
        inert={mobileOpen ? true : undefined}
      >
        {brandBlock}
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          <NavLinks pathname={pathname} items={navItems} />
          <AuthFooter
            authChecked={authChecked}
            userEmail={userEmail}
            signingOut={signingOut}
            onSignOut={() => void signOut()}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <div className="min-w-0 md:hidden">
            <BrandMark size="sm" nameClassName="text-base leading-tight" />
            <p className="truncate text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {tenant}
            </p>
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {tenant}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="md:hidden"
              aria-expanded={mobileOpen}
              aria-controls="org-mobile-nav"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </header>

        {children}
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" id="org-mobile-nav">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawerTitleId}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--card)] px-3 py-4 shadow-[var(--shadow-md)]"
          >
            <div className="mb-4 flex items-start justify-between gap-2">
              <div id={drawerTitleId}>{brandBlock}</div>
              <Button
                ref={closeButtonRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close navigation menu"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <NavLinks
              pathname={pathname}
              items={navItems}
              onNavigate={() => setMobileOpen(false)}
              labelledBy={drawerTitleId}
            />
            <AuthFooter
              authChecked={authChecked}
              userEmail={userEmail}
              signingOut={signingOut}
              onSignOut={() => void signOut()}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
