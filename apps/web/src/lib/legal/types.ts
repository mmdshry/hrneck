export const LEGAL_SLUGS = ["privacy", "terms"] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export type LegalSection = {
  /** Stable anchor id shared by every locale, for example "safeguards". */
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: LegalSlug;
  title: string;
  summary: string;
  /** ISO date (YYYY-MM-DD). Rendered per locale. */
  effectiveDate: string;
  sections: LegalSection[];
};
