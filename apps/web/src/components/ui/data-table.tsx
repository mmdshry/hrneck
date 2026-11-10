"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type {
  DataTableColumn,
  DataTableMode,
  DataTablePagination,
} from "@/components/ui/data-table-types";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableScroll,
  TableTd,
  TableTdText,
  TableTh,
} from "@/components/ui/table-scroll";
import {
  countActiveFilters,
  emptyFilterState,
  filterRowsClient,
  type DataTableFilterState,
} from "@/lib/data-table-query";
import type { PageSize } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export type { DataTableColumn, DataTableMode, DataTablePagination } from "@/components/ui/data-table-types";

function getRowFilterValue<T extends object>(
  row: T,
  column: DataTableColumn<T>,
): unknown {
  if (column.filterValue) return column.filterValue(row);
  if (column.accessorKey) return (row as Record<string, unknown>)[column.accessorKey];
  return undefined;
}

function sortRowsClient<T extends object>(
  rows: T[],
  sorting: DataTableFilterState["sorting"],
  columns: Array<DataTableColumn<T>>,
): T[] {
  const first = sorting[0];
  if (!first) return rows;
  const column = columns.find((c) => c.id === first.id);
  if (!column) return rows;

  const copy = [...rows];
  copy.sort((a, b) => {
    const av = getRowFilterValue(a, column);
    const bv = getRowFilterValue(b, column);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return first.desc ? bv - av : av - bv;
    }
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    if (as < bs) return first.desc ? 1 : -1;
    if (as > bs) return first.desc ? -1 : 1;
    return 0;
  });
  return copy;
}

function FilterControls<T>({
  columns,
  state,
  onColumnFilter,
  compact,
}: {
  columns: Array<DataTableColumn<T>>;
  state: DataTableFilterState;
  onColumnFilter: (id: string, value: string) => void;
  compact?: boolean;
}) {
  const filterable = columns.filter((c) => (c.filter ?? "text") !== "none");
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
      {filterable.map((column) => {
        const variant = column.filter ?? "text";
        const value = state.columnFilters[column.id] ?? "";
        const label = `Filter ${column.header}`;
        if (variant === "select") {
          return (
            <label key={column.id} className="space-y-1 text-sm">
              <span className="text-[var(--muted-foreground)]">{column.header}</span>
              <Select
                aria-label={label}
                value={value}
                onChange={(e) => onColumnFilter(column.id, e.target.value)}
                className="min-h-9"
              >
                <option value="">All</option>
                {(column.filterOptions ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </label>
          );
        }
        return (
          <label key={column.id} className="space-y-1 text-sm">
            <span className="text-[var(--muted-foreground)]">{column.header}</span>
            <Input
              aria-label={label}
              value={value}
              onChange={(e) => onColumnFilter(column.id, e.target.value)}
              placeholder={column.filterPlaceholder ?? `Filter ${column.header.toLowerCase()}…`}
              className="min-h-9"
            />
          </label>
        );
      })}
    </div>
  );
}

export function DataTable<T extends object>({
  columns,
  rows,
  mode = "client",
  filterState,
  onFilterStateChange,
  getRowId,
  caption,
  emptyTitle = "No rows yet.",
  emptyFilteredTitle = "No results for filters",
  emptyDescription,
  toolbarExtra,
  pagination,
  loading = false,
  onRowClick,
  className,
  stickyFirstColumn = true,
}: {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  mode?: DataTableMode;
  /** Controlled filter state (required for server mode; optional for client — internal state used if omitted). */
  filterState?: DataTableFilterState;
  onFilterStateChange?: (next: DataTableFilterState) => void;
  getRowId?: (row: T, index: number) => string | number;
  caption?: string;
  emptyTitle?: string;
  emptyFilteredTitle?: string;
  emptyDescription?: string;
  toolbarExtra?: ReactNode;
  pagination?: DataTablePagination;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
  stickyFirstColumn?: boolean;
}) {
  const [internalState, setInternalState] = useState<DataTableFilterState>(emptyFilterState);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const state = filterState ?? internalState;
  const setState = (next: DataTableFilterState) => {
    if (onFilterStateChange) onFilterStateChange(next);
    else setInternalState(next);
  };

  const searchableKeys = useMemo(
    () =>
      columns
        .filter((c) => c.enableGlobalFilter !== false && (c.filter ?? "text") !== "none")
        .map((c) => c.accessorKey ?? c.id),
    [columns],
  );

  const displayRows = useMemo(() => {
    if (mode === "server") return rows;
    const asRecords = rows as Array<T & Record<string, unknown>>;
    const filtered = filterRowsClient(asRecords, state, {
      searchableKeys,
      getFilterValue: (row, columnId) => {
        const column = columns.find((c) => c.id === columnId);
        if (!column) return (row as Record<string, unknown>)[columnId];
        return getRowFilterValue(row as T, column);
      },
    });
    return sortRowsClient(filtered as T[], state.sorting, columns);
  }, [mode, rows, state, searchableKeys, columns]);

  const activeCount = countActiveFilters(state);
  const hasFilters = activeCount > 0;
  const showEmpty = !loading && displayRows.length === 0;

  const stickyId = stickyFirstColumn
    ? columns.find((c) => c.sticky)?.id ?? columns[0]?.id
    : undefined;

  function setQ(q: string) {
    setState({ ...state, q });
  }

  function setColumnFilter(id: string, value: string) {
    const columnFilters = { ...state.columnFilters };
    if (!value.trim()) delete columnFilters[id];
    else columnFilters[id] = value;
    setState({ ...state, columnFilters });
  }

  function toggleSort(id: string) {
    const current = state.sorting[0];
    if (current?.id === id) {
      if (!current.desc) setState({ ...state, sorting: [{ id, desc: true }] });
      else setState({ ...state, sorting: [] });
      return;
    }
    setState({ ...state, sorting: [{ id, desc: false }] });
  }

  function clearFilters() {
    setState({ ...state, q: "", columnFilters: {} });
  }

  function renderFilterCell(column: DataTableColumn<T>) {
    const variant = column.filter ?? "text";
    if (variant === "none") {
      return <div className="h-9" aria-hidden />;
    }
    const value = state.columnFilters[column.id] ?? "";
    const label = `Filter ${column.header}`;
    if (variant === "select") {
      return (
        <Select
          aria-label={label}
          value={value}
          onChange={(e) => setColumnFilter(column.id, e.target.value)}
          className="min-h-9 min-w-[6rem] text-xs"
        >
          <option value="">All</option>
          {(column.filterOptions ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      );
    }
    return (
      <Input
        aria-label={label}
        value={value}
        onChange={(e) => setColumnFilter(column.id, e.target.value)}
        placeholder={column.filterPlaceholder ?? "Filter…"}
        className="min-h-9 min-w-[6rem] text-xs"
      />
    );
  }

  function sortIcon(columnId: string) {
    const current = state.sorting[0];
    if (current?.id !== columnId) {
      return <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />;
    }
    return current.desc ? (
      <ArrowDown className="size-3.5" aria-hidden />
    ) : (
      <ArrowUp className="size-3.5" aria-hidden />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] max-w-sm flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
              aria-hidden
            />
            <Input
              aria-label="Search table"
              value={state.q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="min-h-11 pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="md:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter className="size-4" aria-hidden />
            Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" aria-hidden />
              Clear
            </Button>
          ) : null}
        </div>
        {toolbarExtra ? <div className="flex flex-wrap items-center gap-2">{toolbarExtra}</div> : null}
      </div>

      {hasFilters ? (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          {state.q.trim() ? (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 text-xs text-[var(--foreground)]">
              Search: {state.q.trim()}
            </span>
          ) : null}
          {Object.entries(state.columnFilters).map(([id, value]) => {
            if (!value.trim()) return null;
            const header = columns.find((c) => c.id === id)?.header ?? id;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 text-xs text-[var(--foreground)]"
              >
                {header}: {value.trim()}
              </span>
            );
          })}
        </div>
      ) : null}

      {showEmpty ? (
        <EmptyState
          title={hasFilters ? emptyFilteredTitle : emptyTitle}
          description={
            emptyDescription ??
            (hasFilters ? "Try clearing search or column filters." : undefined)
          }
        />
      ) : (
        <TableScroll className="rounded-[var(--radius)] border border-[var(--border)]">
          <Table>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="bg-[var(--muted)]/40 text-xs tracking-wide text-[var(--muted-foreground)]">
              <tr>
                {columns.map((column) => {
                  const sortable = column.enableSorting !== false;
                  const isSticky = column.id === stickyId || column.sticky;
                  return (
                    <TableTh
                      key={column.id}
                      scope="col"
                      className={cn(
                        column.headerClassName,
                        isSticky &&
                          "sticky left-0 z-10 bg-[var(--muted)]/95 backdrop-blur-sm",
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 uppercase hover:text-[var(--foreground)]"
                          onClick={() => toggleSort(column.id)}
                        >
                          {column.header}
                          {sortIcon(column.id)}
                        </button>
                      ) : (
                        <span className="uppercase">{column.header}</span>
                      )}
                    </TableTh>
                  );
                })}
              </tr>
              <tr className="hidden border-t border-[var(--border)] md:table-row">
                {columns.map((column) => {
                  const isSticky = column.id === stickyId || column.sticky;
                  return (
                    <TableTh
                      key={`filter-${column.id}`}
                      className={cn(
                        "py-2 font-normal normal-case",
                        column.headerClassName,
                        isSticky &&
                          "sticky left-0 z-10 bg-[var(--card)]",
                      )}
                    >
                      {renderFilterCell(column)}
                    </TableTh>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-t border-[var(--border)]">
                      {columns.map((column) => (
                        <TableTd key={column.id}>
                          <div className="h-4 w-24 animate-pulse rounded bg-[var(--muted)]" />
                        </TableTd>
                      ))}
                    </tr>
                  ))
                : displayRows.map((row, index) => {
                    const id = getRowId?.(row, index) ?? index;
                    return (
                      <tr
                        key={id}
                        className={cn(
                          "border-t border-[var(--border)]",
                          onRowClick && "cursor-pointer hover:bg-[var(--muted)]/30",
                        )}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      >
                        {columns.map((column) => {
                          const isSticky = column.id === stickyId || column.sticky;
                          const content = column.cell(row);
                          const Cell = typeof content === "string" || typeof content === "number"
                            ? TableTdText
                            : TableTd;
                          return (
                            <Cell
                              key={column.id}
                              className={cn(
                                column.className,
                                isSticky &&
                                  "sticky left-0 z-[1] bg-[var(--card)]",
                              )}
                            >
                              {content}
                            </Cell>
                          );
                        })}
                      </tr>
                    );
                  })}
            </tbody>
          </Table>
        </TableScroll>
      )}

      {pagination ? (
        <Pagination
          page={pagination.page}
          perPage={pagination.perPage}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          onPerPageChange={(size: PageSize) => pagination.onPerPageChange(size)}
        />
      ) : null}

      <Dialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Column filters"
        description="Filter this table by column."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
            <Button type="button" onClick={() => setFiltersOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <FilterControls
          columns={columns}
          state={state}
          onColumnFilter={setColumnFilter}
          compact
        />
      </Dialog>
    </div>
  );
}
