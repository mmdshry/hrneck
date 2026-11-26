import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LegalArticle } from "@/components/legal/legal-article";
import { getLegalDocument } from "@/lib/legal/registry";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const document = getLegalDocument("terms", locale);
  return {
    title: document.title,
    description: document.summary,
  };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const document = getLegalDocument("terms", locale);

  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader homeHref="/" />
      <LegalArticle document={document} locale={locale} />
      <LandingFooter homeHref="/" />
    </div>
  );
}
