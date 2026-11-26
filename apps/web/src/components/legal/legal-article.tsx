import {
  Archive,
  Award,
  Ban,
  Building2,
  BookOpen,
  Cookie,
  Database,
  FileText,
  Gavel,
  Handshake,
  Info,
  Key,
  LayoutDashboard,
  Lock,
  Mail,
  Megaphone,
  Receipt,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionHeading } from "@/components/guides/section-heading";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import type { LegalDocument, LegalSection } from "@/lib/legal/types";

/** Keyed by section id, which is shared across locales. */
const SECTION_ICONS: Record<string, LucideIcon> = {
  scope: Building2,
  information: Database,
  phi: FileText,
  use: Scale,
  safeguards: ShieldCheck,
  incidents: Megaphone,
  subcontractors: Handshake,
  individual_rights: UserCheck,
  retention: Archive,
  cookies: Cookie,
  changes: RefreshCw,
  contact: Mail,
  acceptance: FileText,
  definitions: BookOpen,
  services: LayoutDashboard,
  baa: Handshake,
  phi_restrictions: Lock,
  accounts: Key,
  acceptable_use: ShieldCheck,
  customer_responsibilities: Users,
  assistant: Sparkles,
  fees: Receipt,
  intellectual_property: Award,
  disclaimers: Info,
  liability: Scale,
  termination: Ban,
  governing_law: Gavel,
};

function sectionIcon(id: string): LucideIcon {
  return SECTION_ICONS[id] ?? FileText;
}

function formatEffectiveDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export async function LegalArticle({
  document,
  locale,
}: {
  document: LegalDocument;
  locale: string;
}) {
  const t = await getTranslations("legal");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-10 sm:px-6">
      <aside className="hidden w-60 shrink-0 lg:block">
        <nav aria-label={t("onThisPage")} className="sticky top-24">
          <Panel className="p-2">
            <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("onThisPage")}
            </p>
            <ol className="space-y-0.5">
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block min-h-11 rounded-lg px-2 py-2 text-sm text-[var(--muted-foreground)] transition-colors duration-[var(--motion)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </Panel>
        </nav>
      </aside>

      <article className="min-w-0 flex-1 space-y-10">
        <div className="space-y-4">
          <PageHeader title={document.title} description={document.summary} />
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("effectiveDate", {
              date: formatEffectiveDate(document.effectiveDate, locale),
            })}
          </p>
          <Panel className="flex items-start gap-3 p-4">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]"
              aria-hidden
            />
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
              {t("precedenceNotice")}
            </p>
          </Panel>
        </div>

        {document.sections.map((section) => (
          <LegalSectionBlock key={section.id} section={section} />
        ))}
      </article>
    </div>
  );
}

function LegalSectionBlock({ section }: { section: LegalSection }) {
  const Icon = sectionIcon(section.id);

  return (
    <section id={section.id} className="scroll-mt-24 space-y-4">
      <SectionHeading icon={Icon}>{section.title}</SectionHeading>
      {section.paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className="text-sm leading-relaxed text-[var(--muted-foreground)]"
        >
          {paragraph}
        </p>
      ))}
      {section.bullets && section.bullets.length > 0 ? (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--muted-foreground)]">
          {section.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
