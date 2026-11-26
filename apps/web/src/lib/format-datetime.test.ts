import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDateTimeCompact,
  resolveTimeZone,
} from "./format-datetime";

describe("resolveTimeZone", () => {
  it("falls back to UTC for missing or unknown zones", () => {
    expect(resolveTimeZone(null)).toBe("UTC");
    expect(resolveTimeZone(undefined)).toBe("UTC");
    expect(resolveTimeZone("")).toBe("UTC");
    expect(resolveTimeZone("Not/AZone")).toBe("UTC");
  });

  it("keeps valid IANA zones", () => {
    expect(resolveTimeZone("Asia/Tehran")).toBe("Asia/Tehran");
  });
});

describe("formatDateTime", () => {
  it("renders the instant in the organization timezone", () => {
    // 12:00 UTC is 15:30 in Asia/Tehran (no DST since 2022).
    const out = formatDateTime("2026-11-24T12:00:00Z", "Asia/Tehran", "en-US");
    expect(out).toContain("3:30");
    expect(out).toContain("PM");
  });

  it("returns an empty string for missing or invalid values", () => {
    expect(formatDateTime(null, "UTC")).toBe("");
    expect(formatDateTime("not-a-date", "UTC")).toBe("");
  });
});

describe("formatDateTimeCompact", () => {
  it("returns YYYY-MM-DD HH:mm:ss in the organization timezone", () => {
    expect(formatDateTimeCompact("2026-11-24T12:00:00Z", "Asia/Tehran")).toBe("2026-11-24 15:30:00");
  });

  it("crosses the date boundary when the organization is ahead of UTC", () => {
    expect(formatDateTimeCompact("2026-11-24T21:00:00Z", "Asia/Tehran")).toBe("2026-11-25 00:30:00");
  });

  it("uses UTC when no timezone is configured", () => {
    expect(formatDateTimeCompact("2026-11-24T23:30:00Z", null)).toBe("2026-11-24 23:30:00");
  });
});
