import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "./config";

function flatten(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    } else if (typeof value === "string") {
      out[path] = value;
    }
  }
  return out;
}

function loadMessages(locale: string): Record<string, string> {
  const raw = readFileSync(
    join(process.cwd(), "messages", `${locale}.json`),
    "utf8",
  );
  return flatten(JSON.parse(raw) as Record<string, unknown>);
}

describe("message catalog parity", () => {
  const en = loadMessages("en");
  const enKeys = Object.keys(en).sort();

  it("english catalog is non-empty", () => {
    expect(enKeys.length).toBeGreaterThan(100);
  });

  for (const locale of locales.filter((l) => l !== "en")) {
    it(`${locale} has every english key`, () => {
      const other = loadMessages(locale);
      const missing = enKeys.filter((key) => !(key in other));
      expect(missing, `missing in ${locale}: ${missing.slice(0, 20).join(", ")}`).toEqual(
        [],
      );
    });

    it(`${locale} has no empty string values for english keys`, () => {
      const other = loadMessages(locale);
      const empty = enKeys.filter((key) => other[key]?.trim() === "");
      expect(empty).toEqual([]);
    });
  }
});
