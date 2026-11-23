import { loadGuidesForLocale } from "@/lib/guides/content";
import {
  GUIDE_SLUGS,
  type GuideModule,
  type GuideSlug,
} from "@/lib/guides/types";

const DEFAULT_LOCALE = "en";

export function listGuides(locale: string = DEFAULT_LOCALE): GuideModule[] {
  return loadGuidesForLocale(locale);
}

export function getGuide(
  slug: string,
  locale: string = DEFAULT_LOCALE,
): GuideModule | undefined {
  if (!isGuideSlug(slug)) {
    return undefined;
  }
  return loadGuidesForLocale(locale).find((guide) => guide.slug === slug);
}

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(value);
}

export function getAdjacentGuides(
  slug: GuideSlug,
  locale: string = DEFAULT_LOCALE,
): {
  previous: GuideModule | null;
  next: GuideModule | null;
} {
  const guides = loadGuidesForLocale(locale);
  const index = guides.findIndex((guide) => guide.slug === slug);
  if (index < 0) {
    return { previous: null, next: null };
  }
  return {
    previous: index > 0 ? (guides[index - 1] ?? null) : null,
    next: index < guides.length - 1 ? (guides[index + 1] ?? null) : null,
  };
}

export function searchGuides(
  query: string,
  locale: string = DEFAULT_LOCALE,
): GuideModule[] {
  const guides = loadGuidesForLocale(locale);
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return guides;
  }
  return guides.filter((guide) => {
    const sectionText = (guide.sections ?? []).flatMap((section) => [
      section.title,
      section.body ?? "",
      ...section.steps.flatMap((step) => [step.title, step.body]),
    ]);
    const haystack = [
      guide.title,
      guide.summary,
      guide.overview,
      ...guide.keywords,
      ...guide.steps.flatMap((step) => [step.title, step.body]),
      ...sectionText,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function guideHref(slug: GuideSlug): string {
  return `/docs/${slug}`;
}
