"use client";

import { Building2, LineChart, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/landing/reveal";

const STEPS = [
  {
    icon: Building2,
    titleKey: "step1Title",
    bodyKey: "step1Body",
  },
  {
    icon: Workflow,
    titleKey: "step2Title",
    bodyKey: "step2Body",
  },
  {
    icon: LineChart,
    titleKey: "step3Title",
    bodyKey: "step3Body",
  },
] as const;

export function LandingHowItWorks() {
  const t = useTranslations("landing");

  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-[var(--border)] bg-[var(--background)]"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            {t("howItWorksTitle")}
          </h2>
          <p className="mt-4 text-[var(--muted-foreground)]">
            {t("howItWorksBody")}
          </p>
        </Reveal>
        <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-10">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.titleKey} as="li" delayMs={index * 80}>
                <div className="flex h-full flex-col p-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                    {t("step", { n: index + 1 })}
                  </p>
                  <span className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand)]">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl tracking-tight">
                    {t(step.titleKey)}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                    {t(step.bodyKey)}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
