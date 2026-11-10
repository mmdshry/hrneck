import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  deserializeDataTableQuery,
  emptyFilterState,
  filterRowsClient,
  hasActiveFilters,
  matchesTextFilter,
  serializeDataTableQuery,
} from "./data-table-query";

describe("data-table-query", () => {
  it("serializes q, column filters, and sort while skipping empties", () => {
    expect(
      serializeDataTableQuery({
        q: "  alice  ",
        columnFilters: { status: "active", department: "  " },
        sorting: [{ id: "email", desc: true }],
      }),
    ).toEqual({
      q: "alice",
      status: "active",
      sort: "email",
      order: "desc",
    });
  });

  it("deserializes query params into filter state", () => {
    const params = new URLSearchParams(
      "q=bob&status=active&sort=name&order=asc&ignored=1",
    );
    expect(deserializeDataTableQuery(params, ["status", "email"])).toEqual({
      q: "bob",
      columnFilters: { status: "active" },
      sorting: [{ id: "name", desc: false }],
    });
  });

  it("counts and detects active filters", () => {
    const empty = emptyFilterState();
    expect(countActiveFilters(empty)).toBe(0);
    expect(hasActiveFilters(empty)).toBe(false);
    expect(
      countActiveFilters({
        q: "x",
        columnFilters: { a: "1", b: "" },
        sorting: [],
      }),
    ).toBe(2);
  });

  it("matches text filters case-insensitively including arrays", () => {
    expect(matchesTextFilter("Alice", "ali")).toBe(true);
    expect(matchesTextFilter(["Org Admin", "Viewer"], "admin")).toBe(true);
    expect(matchesTextFilter(null, "x")).toBe(false);
  });

  it("filters rows in client mode", () => {
    const rows = [
      { name: "Alice", email: "a@x.com", status: "active" },
      { name: "Bob", email: "b@x.com", status: "archived" },
    ];
    expect(
      filterRowsClient(rows, {
        q: "bob",
        columnFilters: {},
        sorting: [],
      }, { searchableKeys: ["name", "email"] }),
    ).toEqual([rows[1]]);

    expect(
      filterRowsClient(rows, {
        q: "",
        columnFilters: { status: "active" },
        sorting: [],
      }, { searchableKeys: ["name"] }),
    ).toEqual([rows[0]]);
  });
});
