import { describe, expect, it } from "vitest";
import { matchesCells } from "./table-filter";

describe("matchesCells", () => {
  it("passes when the query and column filters are empty", () => {
    expect(matchesCells("", {}, { name: "Alice" })).toBe(true);
    expect(matchesCells("   ", {}, {})).toBe(true);
  });

  it("matches the global query against any cell case-insensitively", () => {
    const cells = { name: "Alice", email: "a@x.com" };
    expect(matchesCells("ALI", {}, cells)).toBe(true);
    expect(matchesCells("  alice  ", {}, cells)).toBe(true);
    expect(matchesCells("X.COM", {}, cells)).toBe(true);
  });

  it("fails when the global query matches no cell", () => {
    expect(matchesCells("bob", {}, { name: "Alice", email: "a@x.com" })).toBe(
      false,
    );
  });

  it("rejects the row when a column filter does not match its cell", () => {
    const cells = { status: "active", name: "inactive user" };
    expect(matchesCells("", { status: "inactive" }, cells)).toBe(false);
    expect(matchesCells("", { status: "ACT" }, cells)).toBe(true);
  });

  it("ignores whitespace-only filter values", () => {
    expect(matchesCells("", { status: "   " }, { status: "active" })).toBe(true);
    expect(matchesCells("", { status: "" }, {})).toBe(true);
  });

  it("treats a missing cell key as an empty string", () => {
    expect(matchesCells("", { owner: "x" }, { name: "Alice" })).toBe(false);
    expect(matchesCells("", { owner: "" }, { name: "Alice" })).toBe(true);
  });
});
