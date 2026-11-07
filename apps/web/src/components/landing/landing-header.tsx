"use client";

import { Menu, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { cn } from "@/lib/utils";

const brand = process.env.NEXT_PUBLIC_BRAND_SHORT ?? "HRNECK";

const ANCHORS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#audiences", label: "Who it’s for" },
  { href: "#demo", label: "Request a demo" },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)]/95">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--foreground)]"
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]"
            aria-hidden
          >
            <ShieldAlert className="h-4 w-4" strokeWidth={2.25} />
          </span>
          {brand}
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Landing"
        >
          {ANCHORS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2.5 text-sm text-[var(--muted-foreground)] transition-colors duration-[var(--motion)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LinkButton
            href="/login"
            variant="ghost"
            className="hidden sm:inline-flex"
          >
            Sign in
          </LinkButton>
          <LinkButton
            href="#demo"
            variant="default"
            className="hidden sm:inline-flex"
          >
            Request a demo
          </LinkButton>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
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
          {ANCHORS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-xl px-3 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2 sm:hidden">
            <LinkButton href="/login" variant="secondary">
              Sign in
            </LinkButton>
            <LinkButton href="#demo" variant="default">
              Request a demo
            </LinkButton>
          </div>
        </nav>
      </div>
    </header>
  );
}
