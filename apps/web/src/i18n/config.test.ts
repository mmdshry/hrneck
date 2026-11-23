import { describe, expect, it } from "vitest";
import {
  defaultLocale,
  isAppLocale,
  localeOptions,
  locales,
  normalizeLocale,
} from "./config";

describe("i18n config", () => {
  it("includes english default and the five added locales", () => {
    expect(defaultLocale).toBe("en");
    expect(locales).toEqual(["en", "es", "fr", "pt", "de", "ru"]);
  });

  it("exposes portugal as a locale option without emoji flags", () => {
    const pt = localeOptions.find((opt) => opt.code === "pt");
    expect(pt?.label).toBe("Português");
    for (const opt of localeOptions) {
      expect(opt).not.toHaveProperty("flag");
    }
  });

  it("normalizes invalid locales to english", () => {
    expect(isAppLocale("fa")).toBe(false);
    expect(normalizeLocale("fa")).toBe("en");
    expect(normalizeLocale("de")).toBe("de");
    expect(normalizeLocale(undefined)).toBe("en");
  });
});
