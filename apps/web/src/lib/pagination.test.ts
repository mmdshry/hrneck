import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
} from "./pagination";

describe("pagination helpers", () => {
  it("exposes 25/50/100 with default 25", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(25);
    expect(PAGE_SIZE_OPTIONS).toEqual([25, 50, 100]);
  });

  it("builds query strings with page and per_page", () => {
    expect(paginationQuery(2, 50, { q: "desk", desk_id: "" })).toBe(
      "page=2&per_page=50&q=desk",
    );
  });

  it("parses meta envelope responses", () => {
    const parsed = parsePaginatedResponse<{ id: number }>({
      data: [{ id: 1 }, { id: 2 }],
      meta: { current_page: 1, last_page: 3, per_page: 25, total: 60 },
    });
    expect(parsed.data).toHaveLength(2);
    expect(parsed.meta).toEqual({
      current_page: 1,
      last_page: 3,
      per_page: 25,
      total: 60,
    });
  });

  it("parses nested Laravel paginator payloads", () => {
    const parsed = parsePaginatedResponse<{ id: number }>({
      data: {
        data: [{ id: 9 }],
        current_page: 2,
        last_page: 4,
        per_page: 50,
        total: 200,
      },
    });
    expect(parsed.data).toEqual([{ id: 9 }]);
    expect(parsed.meta.current_page).toBe(2);
    expect(parsed.meta.total).toBe(200);
  });

  it("slices local lists and clamps page", () => {
    const items = Array.from({ length: 30 }, (_, i) => i + 1);
    const page2 = paginateLocal(items, 2, 25);
    expect(page2.data).toEqual([26, 27, 28, 29, 30]);
    expect(page2.meta.total).toBe(30);
    expect(paginateLocal(items, 99, 25).meta.current_page).toBe(2);
    expect(emptyMeta().per_page).toBe(25);
  });
});
