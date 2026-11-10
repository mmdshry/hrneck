"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { ensureCsrf, fetchSessionUser } from "@/lib/api";
import { hasPermission, type SessionUser } from "@/lib/session";

export function PortalChrome({ children }: { children: ReactNode }) {
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

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/portal/tickets" className="min-w-0">
            <BrandMark size="sm" nameClassName="text-lg font-semibold tracking-tight" />
            <span className="sr-only">Service portal</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <nav className="hidden gap-4 text-sm sm:flex" aria-label="Portal">
              <Link href="/portal/tickets" className="hover:underline">
                My tickets
              </Link>
              <Link href="/portal/kb" className="hover:underline">
                Knowledge base
              </Link>
              <Link href="/learn" className="hover:underline">
                Learn
              </Link>
              {canTechnician ? (
                <Link href="/org/ticketing" className="hover:underline">
                  Technician
                </Link>
              ) : null}
            </nav>
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
