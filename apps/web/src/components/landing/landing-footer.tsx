"use client";

import {
  BookOpen,
  Clock,
  Headphones,
  LogIn,
  Mail,
  MapPin,
  Phone,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { HrneckWordmark } from "@/components/hrneck-wordmark";

const brandName =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "HRneck Training Portal";
const supportEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@hrneck.com";
const supportPhoneDisplay = "858-740-8878";
const supportPhoneTel = "+18587408878";

/** `homeHref` prefixes in-page anchors; see LandingHeader. */
export function LandingFooter({ homeHref = "" }: { homeHref?: string }) {
  const t = useTranslations("landing");
  const tNav = useTranslations("nav");
  const tLegal = useTranslations("legal");

  const links: { href: string; label: string; icon: LucideIcon }[] = useMemo(
    () => [
      { href: "/docs", label: t("guides"), icon: BookOpen },
      { href: "/portal", label: tNav("learnerPortal"), icon: Presentation },
      { href: "/portal/tickets", label: tNav("servicePortal"), icon: Headphones },
      { href: "/login", label: t("signIn"), icon: LogIn },
      { href: `${homeHref}#demo`, label: t("requestDemo"), icon: Mail },
    ],
    [t, tNav, homeHref],
  );

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-14">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-16">
          <div>
            <HrneckWordmark className="h-8" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted-foreground)]">
              {t("footerTagline", { brand: brandName })}
            </p>
            <nav
              className="mt-8 flex flex-col gap-3 text-sm"
              aria-label="Footer"
            >
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex min-h-11 items-center gap-[var(--space-sm)] text-[var(--muted-foreground)] transition-colors duration-[var(--motion)] hover:text-[var(--foreground)]"
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-display)] text-base tracking-tight">
              {t("contact")}
            </h2>
            <dl className="mt-6 space-y-5 text-sm">
              <div>
                <dt className="flex items-center gap-3 font-medium text-[var(--foreground)]">
                  <MapPin
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  {t("postalAddress")}
                </dt>
                <dd className="mt-1.5 pl-7 text-[var(--muted-foreground)]">
                  {t("addressValue")}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-3 font-medium text-[var(--foreground)]">
                  <Clock
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  {t("workHours")}
                </dt>
                <dd className="mt-1.5 space-y-1 pl-7 text-[var(--muted-foreground)]">
                  <p>{t("hoursWeekday")}</p>
                  <p>{t("hoursSaturday")}</p>
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-3 font-medium text-[var(--foreground)]">
                  <Phone
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  {t("phone")}
                </dt>
                <dd className="mt-1.5 pl-7">
                  <a
                    href={`tel:${supportPhoneTel}`}
                    className="inline-flex min-h-11 items-center text-[var(--link)] underline-offset-4 hover:underline"
                  >
                    {supportPhoneDisplay}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-3 font-medium text-[var(--foreground)]">
                  <Mail
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  {t("emailLabel")}
                </dt>
                <dd className="mt-1.5 pl-7">
                  <a
                    href={`mailto:${supportEmail}`}
                    className="inline-flex min-h-11 items-center text-[var(--link)] underline-offset-4 hover:underline"
                  >
                    {supportEmail}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-[var(--border)] pt-6 text-center text-sm text-[var(--muted-foreground)]">
          <nav
            aria-label={tLegal("legalLabel")}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center text-[var(--link)] underline-offset-4 hover:underline"
            >
              {tLegal("privacyPolicy")}
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 items-center text-[var(--link)] underline-offset-4 hover:underline"
            >
              {tLegal("termsOfService")}
            </Link>
          </nav>
          <p>{t("copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
