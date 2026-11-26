import { isAppLocale, type AppLocale } from "@/i18n/config";
import { privacyDe } from "@/lib/legal/content/de/privacy";
import { termsDe } from "@/lib/legal/content/de/terms";
import { privacyEn } from "@/lib/legal/content/en/privacy";
import { termsEn } from "@/lib/legal/content/en/terms";
import { privacyEs } from "@/lib/legal/content/es/privacy";
import { termsEs } from "@/lib/legal/content/es/terms";
import { privacyFr } from "@/lib/legal/content/fr/privacy";
import { termsFr } from "@/lib/legal/content/fr/terms";
import { privacyPt } from "@/lib/legal/content/pt/privacy";
import { termsPt } from "@/lib/legal/content/pt/terms";
import { privacyRu } from "@/lib/legal/content/ru/privacy";
import { termsRu } from "@/lib/legal/content/ru/terms";
import {
  LEGAL_SLUGS,
  type LegalDocument,
  type LegalSlug,
} from "@/lib/legal/types";

const DEFAULT_LOCALE: AppLocale = "en";

const EN_BY_SLUG: Record<LegalSlug, LegalDocument> = {
  privacy: privacyEn,
  terms: termsEn,
};

/**
 * Translated overlays. Any missing locale or slug falls back to the English
 * document, so a partially translated locale never renders an empty page.
 */
const LOCALE_OVERLAYS: Partial<
  Record<AppLocale, Partial<Record<LegalSlug, LegalDocument>>>
> = {
  es: { privacy: privacyEs, terms: termsEs },
  fr: { privacy: privacyFr, terms: termsFr },
  pt: { privacy: privacyPt, terms: termsPt },
  de: { privacy: privacyDe, terms: termsDe },
  ru: { privacy: privacyRu, terms: termsRu },
};

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export function getLegalDocument(
  slug: LegalSlug,
  locale: string = DEFAULT_LOCALE,
): LegalDocument {
  const overlay = isAppLocale(locale) ? LOCALE_OVERLAYS[locale] : undefined;
  return overlay?.[slug] ?? EN_BY_SLUG[slug];
}

export function legalHref(slug: LegalSlug): string {
  return `/${slug}`;
}
