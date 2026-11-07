import { describe, expect, it } from "vitest";
import {
  getAdjacentGuides,
  getGuide,
  guideHref,
  listGuides,
  searchGuides,
} from "@/lib/guides/registry";
import { GUIDE_SLUGS } from "@/lib/guides/types";

describe("guides registry", () => {
  it("lists one guide per slug in order", () => {
    const guides = listGuides();
    expect(guides.map((guide) => guide.slug)).toEqual([...GUIDE_SLUGS]);
  });

  it("returns adjacent guides for the middle of the list", () => {
    const { previous, next } = getAdjacentGuides("training");
    expect(previous?.slug).toBe("targets-groups");
    expect(next?.slug).toBe("checklists");
  });

  it("filters by keyword search", () => {
    const hits = searchGuides("smtp");
    expect(hits.some((guide) => guide.slug === "settings")).toBe(true);
  });

  it("builds guide hrefs", () => {
    expect(guideHref("getting-started")).toBe("/docs/getting-started");
    expect(getGuide("missing")).toBeUndefined();
  });
});
