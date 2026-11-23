"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { HrneckWordmark } from "@/components/hrneck-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

const ANCHOR_HREFS = [
  "#how-it-works",
  "#features",
  "#audiences",
  "#demo",
] as const;

export function LandingHeader() {
  const t = useTranslations("nav");
  const tLanding = useTranslations("landing");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);

  const anchors = [
    { href: ANCHOR_HREFS[0], label: t("howItWorks") },
    { href: ANCHOR_HREFS[1], label: t("features") },
    { href: ANCHOR_HREFS[2], label: t("whoItsFor") },
    { href: ANCHOR_HREFS[3], label: t("requestDemo") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/95">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" aria-label="HRneck" className="inline-flex">
          <HrneckWordmark labelled={false} className="h-8" />
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Landing"
        >
          {anchors.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius)] px-[var(--space-md)] py-[var(--space-sm)] text-sm text-[var(--muted-foreground)] transition-colors duration-[var(--motion)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher className="hidden lg:flex" />
          <ThemeToggle />
          <LinkButton
            href="/login"
            variant="ghost"
            className="hidden sm:inline-flex"
          >
            {tLanding("signIn")}
          </LinkButton>
          <LinkButton
            href="#demo"
            variant="default"
            className="hidden sm:inline-flex"
          >
            {tLanding("requestDemo")}
          </LinkButton>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? tCommon("closeMenu") : tCommon("openMenu")}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              <Menu className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      <div
        id="landing-mobile-nav"
        className={cn(
          "border-t border-[var(--border)] px-6 py-4 lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="flex flex-col gap-1" aria-label="Landing mobile">
          {anchors.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius)] px-[var(--space-md)] py-[var(--space-sm)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <LanguageSwitcher variant="list" persistToAccount={false} />
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:hidden">
            <LinkButton href="/login" variant="secondary">
              {tLanding("signIn")}
            </LinkButton>
            <LinkButton href="#demo" variant="default">
              {tLanding("requestDemo")}
            </LinkButton>
          </div>
        </nav>
      </div>
    </header>
  );
}
