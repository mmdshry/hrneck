"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { ensureCsrf, fetchSessionUser } from "@/lib/api";
import { hasPermission, type SessionUser } from "@/lib/session";

export function PortalChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const [session, setSession] = useState<SessionUser | null>(null);

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

  const canTechnician =
    hasPermission(session, "org.ticketing.tickets") ||
    hasPermission(session, "org.ticketing.admin");

  const navLinkClass =
    "inline-flex min-h-11 items-center text-sm hover:underline";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-[var(--space-lg)] px-6 py-[var(--space-lg)]">
          <Link
            href="/portal/tickets"
            className="inline-flex min-h-11 min-w-0 items-center"
          >
            <BrandMark size="sm" nameClassName="text-lg font-semibold tracking-tight" />
            <span className="sr-only">{t("servicePortal")}</span>
          </Link>
          <div className="flex min-w-0 shrink-0 items-center gap-[var(--space-md)] sm:gap-[var(--space-lg)]">
            <nav
              className="hidden gap-[var(--space-lg)] text-sm md:flex"
              aria-label={t("servicePortal")}
            >
              <Link href="/portal/tickets" className={navLinkClass}>
                {t("myTickets")}
              </Link>
              <Link href="/portal/kb" className={navLinkClass}>
                {t("knowledgeBase")}
              </Link>
              <Link href="/learn" className={navLinkClass}>
                {t("learn")}
              </Link>
              {canTechnician ? (
                <Link href="/org/ticketing" className={navLinkClass}>
                  {t("technician")}
                </Link>
              ) : null}
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
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-6 py-[var(--space-2xl)]">{children}</div>
    </div>
  );
}
