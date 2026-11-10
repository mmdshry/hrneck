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

  it("searches section and step bodies", () => {
    expect(searchGuides("imap").some((guide) => guide.slug === "ticketing")).toBe(
      true,
    );
    expect(
      searchGuides("exit tenant").some((guide) => guide.slug === "msp"),
    ).toBe(true);
    expect(
      searchGuides("/learn").some((guide) => guide.slug === "learner-portal"),
    ).toBe(true);
  });

  it("includes the new surface guides", () => {
    expect(getGuide("learner-portal")?.title).toMatch(/Learner/i);
    expect(getGuide("service-portal")?.title).toMatch(/Service portal/i);
    expect(getGuide("msp")?.title).toMatch(/MSP/i);
    expect(getGuide("auth")?.title).toMatch(/Sign-in|MFA|password/i);
  });

  it("builds guide hrefs", () => {
    expect(guideHref("getting-started")).toBe("/docs/getting-started");
    expect(getGuide("missing")).toBeUndefined();
  });
});
