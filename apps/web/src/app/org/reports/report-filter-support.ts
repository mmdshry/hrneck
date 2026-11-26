import type { ReportSharedFilters, ReportTab } from "./report-types";

/**
 * Which shared filters each Reporting tab actually applies on the API.
 * A filter a tab ignores is hidden in the UI and never sent, so the screen never implies a filter that did nothing.
 */
export type ReportFilterSupport = {
  department: boolean;
  dateRange: boolean;
};

const FILTER_SUPPORT: Record<ReportTab, ReportFilterSupport> = {
  overview: { department: true, dateRange: true },
  company: { department: true, dateRange: false },
  users: { department: true, dateRange: false },
  targets: { department: true, dateRange: false },
  campaigns: { department: true, dateRange: true },
  training: { department: true, dateRange: true },
  checklists: { department: true, dateRange: true },
  ticketing: { department: true, dateRange: true },
};

export function filterSupportForTab(tab: ReportTab): ReportFilterSupport {
  return FILTER_SUPPORT[tab];
}

/**
 * Filters to send for one tab: only the keys that tab's API endpoints apply.
 */
export function sharedFiltersForTab(
  tab: ReportTab,
  filters: ReportSharedFilters,
): ReportSharedFilters {
  const support = FILTER_SUPPORT[tab];

  return {
    ...(support.department && filters.department_id
      ? { department_id: filters.department_id }
      : {}),
    ...(support.dateRange && filters.from ? { from: filters.from } : {}),
    ...(support.dateRange && filters.to ? { to: filters.to } : {}),
  };
}
