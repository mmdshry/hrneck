"use client";

import {
  BookOpen,
  Building2,
  ClipboardList,
  Download,
  GraduationCap,
  KeyRound,
  Presentation,
  Settings2,
  ShieldAlert,
  Target,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/landing/reveal";

const FEATURE_KEYS = [
  { icon: Building2, titleKey: "featureMspTitle", bodyKey: "featureMspBody" },
  { icon: GraduationCap, titleKey: "featureLmsTitle", bodyKey: "featureLmsBody" },
  {
    icon: ClipboardList,
    titleKey: "featureChecklistsTitle",
    bodyKey: "featureChecklistsBody",
  },
  {
    icon: Ticket,
    titleKey: "featureTicketingTitle",
    bodyKey: "featureTicketingBody",
  },
  {
    icon: BookOpen,
    titleKey: "featurePortalTitle",
    bodyKey: "featurePortalBody",
  },
  {
    icon: Target,
    titleKey: "featureEmployeesTitle",
    bodyKey: "featureEmployeesBody",
  },
  {
    icon: Users,
    titleKey: "featureUsersTitle",
    bodyKey: "featureUsersBody",
  },
  {
    icon: KeyRound,
    titleKey: "featurePermissionsTitle",
    bodyKey: "featurePermissionsBody",
  },
  {
    icon: ShieldAlert,
    titleKey: "featureReportingTitle",
    bodyKey: "featureReportingBody",
  },
  {
    icon: Download,
    titleKey: "featurePdfTitle",
    bodyKey: "featurePdfBody",
  },
  {
    icon: Presentation,
    titleKey: "featureLearnerTitle",
    bodyKey: "featureLearnerBody",
  },
  {
    icon: Settings2,
    titleKey: "featureSettingsTitle",
    bodyKey: "featureSettingsBody",
  },
] as const satisfies ReadonlyArray<{
  icon: LucideIcon;
  titleKey: string;
  bodyKey: string;
}>;

export function LandingFeatures() {
  const t = useTranslations("landing");

  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-[var(--border)]"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight md:text-4xl">
            {t("featuresTitle")}
          </h2>
          <p className="mt-4 text-[var(--muted-foreground)]">
            {t("featuresBody")}
          </p>
        </Reveal>
        <ul className="mt-14 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_KEYS.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal
                key={feature.titleKey}
                as="li"
                delayMs={(index % 3) * 70}
                className="group"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-[var(--brand)] transition-colors duration-[var(--motion)] group-hover:bg-[color-mix(in_srgb,var(--brand)_16%,transparent)]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-lg tracking-tight">
                  {t(feature.titleKey)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {t(feature.bodyKey)}
                </p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
