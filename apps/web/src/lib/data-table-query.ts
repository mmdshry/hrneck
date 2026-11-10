export type ColumnFilterValue = string;

export type DataTableFilterState = {
  q: string;
  columnFilters: Record<string, ColumnFilterValue>;
  sorting: Array<{ id: string; desc: boolean }>;
};

export function emptyFilterState(): DataTableFilterState {
  return { q: "", columnFilters: {}, sorting: [] };
}

export function countActiveFilters(state: DataTableFilterState): number {
  let count = state.q.trim() ? 1 : 0;
  for (const value of Object.values(state.columnFilters)) {
    if (value.trim()) count += 1;
  }
  return count;
}

export function hasActiveFilters(state: DataTableFilterState): boolean {
  return countActiveFilters(state) > 0;
}

/** Serialize filter state into flat query params (skips empty values). */
export function serializeDataTableQuery(
  state: DataTableFilterState,
  extra?: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const q = state.q.trim();
  if (q) out.q = q;

  for (const [key, value] of Object.entries(state.columnFilters)) {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  }

  if (state.sorting.length > 0) {
    const first = state.sorting[0];
    if (first) {
      out.sort = first.id;
      out.order = first.desc ? "desc" : "asc";
    }
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === null || value === undefined || value === "") continue;
      out[key] = String(value);
    }
  }

  return out;
}

export function deserializeDataTableQuery(
  params: URLSearchParams | Record<string, string | undefined>,
  columnIds: string[],
): DataTableFilterState {
  const get =
    params instanceof URLSearchParams
      ? (key: string) => params.get(key) ?? ""
      : (key: string) => params[key] ?? "";

  const columnFilters: Record<string, string> = {};
  for (const id of columnIds) {
    const value = get(id).trim();
    if (value) columnFilters[id] = value;
  }

  const sort = get("sort").trim();
  const order = get("order").trim().toLowerCase();
  const sorting =
    sort.length > 0
      ? [{ id: sort, desc: order === "desc" }]
      : ([] as Array<{ id: string; desc: boolean }>);

  return {
    q: get("q"),
    columnFilters,
    sorting,
  };
}

/** Case-insensitive substring match used by client-mode filtering. */
export function matchesTextFilter(cell: unknown, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  if (cell == null) return false;
  if (Array.isArray(cell)) {
    return cell.some((item) => String(item).toLowerCase().includes(needle));
  }
  return String(cell).toLowerCase().includes(needle);
}

export function rowMatchesGlobalFilter<T extends Record<string, unknown>>(
  row: T,
  q: string,
  searchableKeys: string[],
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (searchableKeys.length === 0) {
    return Object.values(row).some((value) => matchesTextFilter(value, needle));
  }
  return searchableKeys.some((key) => matchesTextFilter(row[key], needle));
}

export function filterRowsClient<T extends Record<string, unknown>>(
  rows: T[],
  state: DataTableFilterState,
  options: {
    searchableKeys?: string[];
    getFilterValue?: (row: T, columnId: string) => unknown;
  } = {},
): T[] {
  const searchableKeys = options.searchableKeys ?? [];
  const getFilterValue =
    options.getFilterValue ?? ((row: T, columnId: string) => row[columnId]);

  return rows.filter((row) => {
    if (!rowMatchesGlobalFilter(row, state.q, searchableKeys)) return false;
    for (const [columnId, filter] of Object.entries(state.columnFilters)) {
      if (!filter.trim()) continue;
      if (!matchesTextFilter(getFilterValue(row, columnId), filter)) return false;
    }
    return true;
  });
}
