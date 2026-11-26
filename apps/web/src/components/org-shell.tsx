"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { canShowAssistant } from "@/components/assistant/assistant-visibility";
import { BrandMark } from "@/components/brand-mark";
import { OrgMembershipGate } from "@/components/org-membership-gate";
import { OrgNoAccess } from "@/components/org-no-access";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SubscriptionNotice } from "@/components/subscription-notice";
import { ThemeToggle } from "@/components/theme-toggle";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Button } from "@/components/ui/button";
import { api, ensureCsrf, fetchSessionUser, signOut as apiSignOut } from "@/lib/api";
import { type NavItem, visibleOrgNav } from "@/lib/org-nav";
import { isOrgRouteDenied } from "@/lib/org-route-permissions";
import { matchOrgMembership, type SessionUser } from "@/lib/session";
import { clearTenant, resolveTenant, setTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

function matchesPath(pathname: string, item: NavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Only the longest matching href is active — avoids parent+child both highlighted. */
function isNavActive(pathname: string, item: NavItem, items: NavItem[]): boolean {
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
              "flex min-h-11 items-center gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-colors duration-[var(--motion)]",
              active
                ? "bg-[var(--primary)] font-medium text-[var(--primary-foreground)] shadow-[var(--shadow-sm)]"
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

function SidebarUserProfile({
  authChecked,
  user,
  onAvatarChanged,
}: {
  authChecked: boolean;
  user: SessionUser | null;
  onAvatarChanged?: (url: string | null) => void;
}) {
  const userEmail = user?.email ?? null;
  if (!authChecked || !userEmail) {
    return null;
  }

  const displayName = user?.name?.trim() || userEmail;
  const operatorRole = (user?.roles ?? []).find((role) => role !== "learner");
  const profileLine = operatorRole
    ? [operatorRole, user?.department].filter(Boolean).join(" . ")
    : [user?.job_title, user?.target_department].filter(Boolean).join(" . ");

  return (
    <div className="mb-6 flex items-center gap-3 px-2">
      <AvatarUploader
        name={user?.name}
        email={userEmail}
        avatarUrl={user?.avatar_url}
        endpoint="/api/v1/auth/avatar"
        size="md"
        variant="dialog"
        onChanged={onAvatarChanged}
      />
      <div className="min-w-0 space-y-0.5">
        <p
          className="truncate text-sm font-medium text-[var(--foreground)]"
          title={displayName}
        >
          {displayName}
        </p>
        {user?.name?.trim() ? (
          <p
            className="truncate text-xs text-[var(--muted-foreground)]"
            title={userEmail}
          >
            {userEmail}
          </p>
        ) : null}
        {profileLine ? (
          <p
            className="truncate text-xs text-[var(--muted-foreground)]"
            title={profileLine}
          >
            {profileLine}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AuthFooter({
  authChecked,
  userEmail,
  signingOut,
  onSignOut,
  onNavigate,
  footerExtras,
}: {
  authChecked: boolean;
  userEmail: string | null;
  signingOut: boolean;
  onSignOut: () => void;
  onNavigate?: () => void;
  footerExtras?: ReactNode;
}) {
  return (
    <div className="mt-4 space-y-2 border-t border-[var(--border)] px-2 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Theme
        </p>
        <ThemeToggle />
      </div>
      {footerExtras}
      {authChecked && userEmail ? (
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
      ) : (
        <Link
          href="/login"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius)] px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          <LogIn className="h-4 w-4 shrink-0" aria-hidden />
          Sign in
        </Link>
      )}
    </div>
  );
}

type OrgShellProps = {
  children: ReactNode;
  /** Sidebar menu for the signed-in user. Defaults to the organization console menu. */
  resolveNavItems?: (user: SessionUser | null) => NavItem[];
  /** Extra footer row shown above sign out, for example a language switcher. */
  footerExtras?: ReactNode;
};

export function OrgShell({
  children,
  resolveNavItems = visibleOrgNav,
  footerExtras,
}: OrgShellProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [leavingTenant, setLeavingTenant] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navPathname, setNavPathname] = useState(pathname);
  // Prefer session tenant on SSR; resolve host/query only after mount to avoid hydration mismatch.
  const [tenant, setResolvedTenant] = useState<string>("");
  const drawerTitleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const preferredTenant = user?.staff_tenant_id ?? user?.tenant_id ?? null;
  const navItems = resolveNavItems(user);
  const actingInTenant = Boolean(user?.acting_in_tenant && user.staff_tenant_id);
  const membership = user && tenant ? matchOrgMembership(user, tenant) : null;
  const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");
  const isOrgRoute = pathname === "/org" || pathname.startsWith("/org/");
  // Hard gate is org-workspace only; /msp must stay reachable so staff can enter.
  const membershipDenied =
    isOrgRoute && authChecked && user && membership && membership.ok === false
      ? membership
      : null;
  // Page-level permission gate. Membership problems are reported first (see render below).
  const routeDenied =
    isOrgRoute && authChecked && user !== null && isOrgRouteDenied(pathname, user.permissions);

  const showAssistant = canShowAssistant({
    isOrgRoute,
    authChecked,
    hasUser: user !== null,
    tenant,
    membershipDenied: membershipDenied !== null,
  });

  if (navPathname !== pathname) {
    setNavPathname(pathname);
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }

  useEffect(() => {
    setResolvedTenant(resolveTenant(preferredTenant));
  }, [preferredTenant, pathname]);

  useEffect(() => {
    void fetchSessionUser()
      .then((sessionUser) => {
        setUser(sessionUser);
        setUserEmail(sessionUser?.email ?? null);
        setAuthError(null);
        setAuthChecked(true);
        if (sessionUser?.staff_tenant_id) {
          setTenant(sessionUser.staff_tenant_id);
        } else if (sessionUser?.tenant_id) {
          setTenant(sessionUser.tenant_id);
        }
      })
      .catch((err) => {
        setAuthError(err instanceof Error ? err.message : "Unable to verify session");
        setAuthChecked(true);
      });
  }, [pathname]);

  useEffect(() => {
    if (!authChecked || user || authError) {
      return;
    }
    // Guides stay public; MSP/org require a session (API already enforces this).
    if (pathname === "/docs" || pathname.startsWith("/docs/")) {
      return;
    }
    const next = encodeURIComponent(pathname || "/org");
    window.location.replace(`/login?next=${next}`);
  }, [authChecked, user, pathname, authError]);

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

  async function leaveTenantContext() {
    setLeavingTenant(true);
    try {
      await ensureCsrf();
      await api("/api/v1/msp/tenants/leave", { method: "POST" });
      clearTenant();
      window.location.assign("/msp");
    } catch {
      setLeavingTenant(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await apiSignOut();
      setUser(null);
      setUserEmail(null);
      clearTenant();
      setMobileOpen(false);
      window.location.replace("/login");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign out failed");
      setSigningOut(false);
    }
  }

  function handleAvatarChanged(url: string | null) {
    setUser((prev) => (prev ? { ...prev, avatar_url: url } : prev));
  }

  const brandBlock = (
    <div className="px-2">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
        {tenant}
      </p>
      <div className="mt-1">
        <BrandMark size="lg" showName={false} />
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
          <SidebarUserProfile
            authChecked={authChecked}
            user={user}
            onAvatarChanged={handleAvatarChanged}
          />
          <NavLinks pathname={pathname} items={navItems} />
          <AuthFooter
            authChecked={authChecked}
            userEmail={userEmail}
            signingOut={signingOut}
            onSignOut={() => void signOut()}
            footerExtras={footerExtras}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <div className="min-w-0 md:hidden">
            <BrandMark size="sm" showName={false} />
            <p className="truncate text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {tenant}
            </p>
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
              {user?.name?.trim() || userEmail || ""}
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

        {actingInTenant ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm">
            <p>
              Viewing as platform staff in <strong>{user?.staff_tenant_id}</strong>
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={leavingTenant}
              onClick={() => void leaveTenantContext()}
            >
              {leavingTenant ? "Leaving…" : "Exit tenant"}
            </Button>
          </div>
        ) : null}

        {authError ? (
          <div className="border-b border-[var(--border)] px-4 py-3 text-sm text-[#991b1b]">
            {authError}
          </div>
        ) : null}

        <SubscriptionNotice subscription={user?.subscription} />

        {membershipDenied ? (
          <OrgMembershipGate
            denial={membershipDenied}
            currentTenant={tenant}
            pathname={pathname}
            search={
              typeof window !== "undefined" ? window.location.search : ""
            }
          />
        ) : isDocsRoute || (authChecked && user) ? (
          routeDenied ? <OrgNoAccess /> : children
        ) : null}
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
            className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--card)] px-3 py-4 shadow-[var(--shadow-md)]"
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
            <div className="flex min-h-0 flex-1 flex-col">
              <SidebarUserProfile
                authChecked={authChecked}
                user={user}
                onAvatarChanged={handleAvatarChanged}
              />
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
                footerExtras={footerExtras}
              />
            </div>
          </aside>
        </div>
      ) : null}
      {showAssistant ? <AssistantPanel key={tenant} tenant={tenant} /> : null}
    </div>
  );
}
