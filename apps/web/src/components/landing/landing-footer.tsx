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
import { HrneckWordmark } from "@/components/hrneck-wordmark";

const brandName =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "HRNECK Training Portal";
const supportEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "support@hrneck.com";
const supportPhoneDisplay = "858-740-8878";
const supportPhoneTel = "+18587408878";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/docs", label: "Guides", icon: BookOpen },
  { href: "/learn", label: "Learner portal", icon: Presentation },
  { href: "/portal", label: "Service portal", icon: Headphones },
  { href: "/login", label: "Sign in", icon: LogIn },
  { href: "#demo", label: "Request a demo", icon: Mail },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-14">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-16">
          <div>
            <HrneckWordmark className="h-8" />
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted-foreground)]">
              {brandName} — security awareness for MSPs and organizations.
            </p>
            <nav
              className="mt-8 flex flex-col gap-3 text-sm"
              aria-label="Footer"
            >
              {LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-2.5 text-[var(--muted-foreground)] transition-colors duration-[var(--motion)] hover:text-[var(--foreground)]"
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
              Contact
            </h2>
            <dl className="mt-6 space-y-5 text-sm">
              <div>
                <dt className="flex items-center gap-3 font-medium text-[var(--foreground)]">
                  <MapPin
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  Postal Address
                </dt>
                <dd className="mt-1.5 pl-7 text-[var(--muted-foreground)]">
                  San Diego, CA
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-3 font-medium text-[var(--foreground)]">
                  <Clock
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  Work Hours
                </dt>
                <dd className="mt-1.5 space-y-1 pl-7 text-[var(--muted-foreground)]">
                  <p>Monday–Friday, 7:00 AM – 7:00 PM</p>
                  <p>Saturday, 8:00 AM – 3:00 PM</p>
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-3 font-medium text-[var(--foreground)]">
                  <Phone
                    className="h-4 w-4 shrink-0 text-[var(--brand)]"
                    aria-hidden
                  />
                  Phone
                </dt>
                <dd className="mt-1.5 pl-7">
                  <a
                    href={`tel:${supportPhoneTel}`}
                    className="text-[var(--primary)] underline-offset-4 hover:underline"
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
                  Email
                </dt>
                <dd className="mt-1.5 pl-7">
                  <a
                    href={`mailto:${supportEmail}`}
                    className="text-[var(--primary)] underline-offset-4 hover:underline"
                  >
                    {supportEmail}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="mt-12 border-t border-[var(--border)] pt-6 text-center text-sm text-[var(--muted-foreground)]">
          © 2026 HRneck. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
