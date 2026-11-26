"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  isEndUserNavActive,
  visibleEndUserNav,
  type EndUserNavItem,
} from "@/lib/end-user-nav";
import type { SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ID = "end-user-mobile-nav";

type EndUserChromeProps = {
  children: ReactNode;
  /** Where the brand mark links to (the user's home inside this area). */
  brandHref: string;
  /** Screen-reader text for the brand link. */
  brandLabel: string;
  /** Accessible name for the navigation landmark. */
  navLabel: string;
  navItems: EndUserNavItem[];
};

/**
 * Shared header for end-user areas (service portal, learner portal).
 * Desktop shows inline links; below md the links move into a toggle menu.
 */
export function EndUserChrome({
  children,
  brandHref,
  brandLabel,
  navLabel,
  navItems,
}: EndUserChromeProps) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        setSession(await fetchSessionUser());
      } catch {
        setSession(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuToggleRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const items = visibleEndUserNav(navItems, session);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-[var(--space-lg)] px-4 py-[var(--space-lg)] sm:px-6">
          <Link
            href={brandHref}
            className="inline-flex min-h-11 min-w-0 items-center"
          >
            <BrandMark
              size="sm"
              nameClassName="text-lg font-semibold tracking-tight"
            />
            <span className="sr-only">{brandLabel}</span>
          </Link>
          <div className="flex min-w-0 shrink-0 items-center gap-[var(--space-md)] sm:gap-[var(--space-lg)]">
            <nav
              className="hidden gap-[var(--space-lg)] text-sm md:flex"
              aria-label={navLabel}
            >
              {items.map((item) => {
                const active = isEndUserNavActive(pathname, item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center text-sm hover:underline",
                      active && "font-semibold underline underline-offset-4",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <NotificationBell />
            <LanguageSwitcher className="hidden sm:flex" />
            <ThemeToggle />
            {session ? (
              <Avatar
                src={session.avatar_url}
                name={session.name}
                email={session.email}
                size="sm"
                alt={session.name || session.email}
              />
            ) : null}
            <Button
              ref={menuToggleRef}
              type="button"
              variant="secondary"
              size="icon"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-controls={MOBILE_NAV_ID}
              aria-label={menuOpen ? t("closeNavigation") : t("openNavigation")}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <nav
            id={MOBILE_NAV_ID}
            className="mx-auto max-w-5xl border-t border-[var(--border)] px-4 py-3 md:hidden sm:px-6"
            aria-label={navLabel}
          >
            <ul className="space-y-1">
              {items.map((item) => {
                const active = isEndUserNavActive(pathname, item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center rounded-[var(--radius)] px-3 text-sm hover:bg-[var(--muted)]",
                        active && "bg-[var(--muted)] font-medium",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 sm:hidden">
              <LanguageSwitcher variant="list" />
            </div>
          </nav>
        ) : null}
      </header>
      <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-[var(--space-2xl)] sm:px-6">
        {children}
      </div>
    </div>
  );
}
