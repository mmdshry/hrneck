"use client";

import { Building2, Headphones, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";

export function LandingAudiences() {
  const t = useTranslations("landing");

  return (
    <section
      id="audiences"
      className="scroll-mt-24 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_35%,var(--background))]"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            {t("audiencesTitle")}
          </h2>
          <p className="mt-4 text-[var(--muted-foreground)]">
            {t("audiencesBody")}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
          <Reveal>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand)]">
              <Building2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl tracking-tight">
              {t("mspTitle")}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
              {t("mspBody")}
            </p>
          </Reveal>
          <Reveal delayMs={90}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand)]">
              <Shield className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-2xl tracking-tight">
              {t("orgsTitle")}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
              {t("orgsBody")}
            </p>
          </Reveal>
        </div>

        <Reveal className="mt-14 flex flex-wrap items-start gap-6 border-t border-[var(--border)] pt-10 text-sm text-[var(--muted-foreground)]">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--card)] text-[var(--brand)]">
            <Headphones className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="max-w-3xl leading-relaxed">
            {t.rich("employeesUse", {
              learnerLink: (chunks) => (
                <Link
                  href="/portal"
                  className="font-medium text-[var(--link)] underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
              serviceLink: (chunks) => (
                <Link
                  href="/portal/tickets"
                  className="font-medium text-[var(--link)] underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
