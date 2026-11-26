import { describe, expect, it } from "vitest";
import {
  filterSupportForTab,
  sharedFiltersForTab,
} from "./report-filter-support";
import type { ReportTab } from "./report-types";

const ALL_TABS: ReportTab[] = [
  "overview",
  "company",
  "users",
  "targets",
  "campaigns",
  "training",
  "checklists",
  "ticketing",
];

const DATED_TABS: ReportTab[] = [
  "overview",
  "campaigns",
  "training",
  "checklists",
  "ticketing",
];

const UNDATED_TABS: ReportTab[] = ["company", "users", "targets"];

const ALL_FILTERS = {
  department_id: "7",
  from: "2026-01-01",
  to: "2026-03-31",
};

describe("filterSupportForTab", () => {
  it("supports the department filter on every tab", () => {
    for (const tab of ALL_TABS) {
      expect(filterSupportForTab(tab).department, tab).toBe(true);
    }
  });

  it("supports the date range only on tabs that filter by time", () => {
    for (const tab of DATED_TABS) {
      expect(filterSupportForTab(tab).dateRange, tab).toBe(true);
    }
    for (const tab of UNDATED_TABS) {
      expect(filterSupportForTab(tab).dateRange, tab).toBe(false);
    }
  });
});

describe("sharedFiltersForTab", () => {
  it("sends the full filter set on a dated tab", () => {
    expect(sharedFiltersForTab("campaigns", ALL_FILTERS)).toEqual(ALL_FILTERS);
    expect(sharedFiltersForTab("overview", ALL_FILTERS)).toEqual(ALL_FILTERS);
  });

  it("drops the date range on a tab that ignores it", () => {
    for (const tab of UNDATED_TABS) {
      expect(sharedFiltersForTab(tab, ALL_FILTERS), tab).toEqual({
        department_id: "7",
      });
    }
  });

  it("sends nothing when no filter is set", () => {
    expect(sharedFiltersForTab("overview", {})).toEqual({});
  });

  it("omits empty values instead of sending blank filters", () => {
    expect(
      sharedFiltersForTab("overview", { department_id: "", from: "2026-01-01" }),
    ).toEqual({ from: "2026-01-01" });
  });
});
