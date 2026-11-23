import { describe, expect, it } from "vitest";
import { locales, type AppLocale } from "@/i18n/config";
import { getGuide, listGuides, searchGuides } from "@/lib/guides/registry";
import { GUIDE_SLUGS, type GuideModule } from "@/lib/guides/types";

function assertGuideShape(guide: GuideModule, en: GuideModule) {
  expect(guide.slug).toBe(en.slug);
  expect(guide.title.trim().length).toBeGreaterThan(0);
  expect(guide.summary.trim().length).toBeGreaterThan(0);
  expect(guide.overview.trim().length).toBeGreaterThan(0);
  expect(guide.example.title.trim().length).toBeGreaterThan(0);
  expect(guide.example.narrative.trim().length).toBeGreaterThan(0);
  expect(guide.steps.length).toBe(en.steps.length);
  expect(guide.diagram.nodes.length).toBe(en.diagram.nodes.length);
  expect(guide.diagram.edges.length).toBe(en.diagram.edges.length);
  expect(guide.mock.stats.length).toBe(en.mock.stats.length);
  expect(guide.mock.rows.length).toBe(en.mock.rows.length);
  expect(guide.mock.annotations.length).toBe(en.mock.annotations.length);
  expect(guide.related).toEqual(en.related);
  expect(guide.openInAppHref).toBe(en.openInAppHref);
  for (const step of guide.steps) {
    expect(step.title.trim().length).toBeGreaterThan(0);
    expect(step.body.trim().length).toBeGreaterThan(0);
  }
}

describe("localized guides", () => {
  const enGuides = listGuides("en");
  const enBySlug = Object.fromEntries(
    enGuides.map((guide) => [guide.slug, guide]),
  ) as Record<(typeof GUIDE_SLUGS)[number], GuideModule>;

  it("english has all 14 guide slugs", () => {
    expect(enGuides.map((g) => g.slug).sort()).toEqual([...GUIDE_SLUGS].sort());
  });

  for (const locale of locales as readonly AppLocale[]) {
    it(`${locale} has structurally complete guides for every slug`, () => {
      const guides = listGuides(locale);
      expect(guides).toHaveLength(GUIDE_SLUGS.length);
      for (const slug of GUIDE_SLUGS) {
        const guide = getGuide(slug, locale);
        expect(guide, `missing ${slug} in ${locale}`).toBeDefined();
        assertGuideShape(guide!, enBySlug[slug]);
      }
    });
  }

  it("spanish search finds a translated getting-started title", () => {
    const es = getGuide("getting-started", "es");
    expect(es).toBeDefined();
    const needle = es!.title.split(/\s+/).find((w) => w.length > 4) ?? es!.title;
    const hits = searchGuides(needle, "es");
    expect(hits.some((g) => g.slug === "getting-started")).toBe(true);
  });

  it("non-english getting-started title differs from english", () => {
    const en = getGuide("getting-started", "en")!;
    for (const locale of ["es", "fr", "pt", "de", "ru"] as AppLocale[]) {
      const localized = getGuide("getting-started", locale)!;
      expect(localized.title).not.toBe(en.title);
    }
  });
});
