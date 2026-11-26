import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import {
  getLegalDocument,
  isLegalSlug,
  legalHref,
} from "@/lib/legal/registry";
import { LEGAL_SLUGS } from "@/lib/legal/types";

const REQUIRED_SECTION_IDS = {
  privacy: [
    "scope",
    "information",
    "phi",
    "use",
    "safeguards",
    "incidents",
    "subcontractors",
    "individual_rights",
    "retention",
    "cookies",
    "changes",
    "contact",
  ],
  terms: [
    "acceptance",
    "definitions",
    "services",
    "baa",
    "phi_restrictions",
    "accounts",
    "acceptable_use",
    "customer_responsibilities",
    "assistant",
    "fees",
    "intellectual_property",
    "disclaimers",
    "liability",
    "termination",
    "governing_law",
    "changes",
    "contact",
  ],
} as const;

describe("legal registry", () => {
  it("recognizes only the supported legal slugs", () => {
    expect(LEGAL_SLUGS).toEqual(["privacy", "terms"]);
    expect(isLegalSlug("privacy")).toBe(true);
    expect(isLegalSlug("terms")).toBe(true);
    expect(isLegalSlug("cookies")).toBe(false);
  });

  it("builds public hrefs at the root", () => {
    expect(legalHref("privacy")).toBe("/privacy");
    expect(legalHref("terms")).toBe("/terms");
  });

  it("falls back to english for unsupported locales", () => {
    expect(getLegalDocument("privacy", "fa").title).toBe(
      getLegalDocument("privacy", "en").title,
    );
    expect(getLegalDocument("terms", "zh").title).toBe(
      getLegalDocument("terms", "en").title,
    );
  });

  it("returns a translated document for every supported locale", () => {
    const english = {
      privacy: getLegalDocument("privacy", "en").title,
      terms: getLegalDocument("terms", "en").title,
    };
    for (const locale of locales.filter((code) => code !== "en")) {
      expect(getLegalDocument("privacy", locale).title).not.toBe(english.privacy);
      expect(getLegalDocument("terms", locale).title).not.toBe(english.terms);
    }
  });

  for (const slug of LEGAL_SLUGS) {
    it(`${slug} has the required sections in every locale`, () => {
      for (const locale of locales) {
        const ids = getLegalDocument(slug, locale).sections.map(
          (section) => section.id,
        );
        expect(ids, `${slug} ${locale}`).toEqual([...REQUIRED_SECTION_IDS[slug]]);
      }
    });

    it(`${slug} keeps the same section order and ids in every locale`, () => {
      const englishIds = getLegalDocument(slug, "en").sections.map(
        (section) => section.id,
      );
      for (const locale of locales) {
        const ids = getLegalDocument(slug, locale).sections.map(
          (section) => section.id,
        );
        expect(ids, `${slug} ${locale}`).toEqual(englishIds);
      }
    });

    it(`${slug} has non-empty titles, paragraphs, and bullets`, () => {
      for (const locale of locales) {
        const document = getLegalDocument(slug, locale);
        expect(document.slug).toBe(slug);
        expect(document.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        for (const section of document.sections) {
          expect(section.title.trim(), `${locale}:${section.id}`).not.toBe("");
          expect(section.paragraphs.length, `${locale}:${section.id}`).toBeGreaterThan(0);
          for (const paragraph of section.paragraphs) {
            expect(paragraph.trim(), `${locale}:${section.id}`).not.toBe("");
          }
          for (const bullet of section.bullets ?? []) {
            expect(bullet.trim(), `${locale}:${section.id}`).not.toBe("");
          }
        }
      }
    });
  }

  it("keeps the Business Associate Agreement precedence rule in the terms", () => {
    const baa = getLegalDocument("terms", "en").sections.find(
      (section) => section.id === "baa",
    );
    expect(baa?.paragraphs.join(" ")).toMatch(/BAA controls/);
  });
});
