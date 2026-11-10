"use client";

import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { DataTableFilterState } from "@/lib/data-table-query";
import type { DataTablePagination } from "@/components/ui/data-table-types";

export type ReportColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  filter?: DataTableColumn<T>["filter"];
  filterOptions?: DataTableColumn<T>["filterOptions"];
  accessorKey?: DataTableColumn<T>["accessorKey"];
  filterValue?: DataTableColumn<T>["filterValue"];
  enableSorting?: boolean;
};

export function ReportTable<T extends object>({
  columns,
  rows,
  empty = "No rows yet.",
  onRowClick,
  mode = "client",
  filterState,
  onFilterStateChange,
  pagination,
  loading,
  toolbarExtra,
  caption,
}: {
  columns: Array<ReportColumn<T>>;
  rows: T[];
  empty?: string;
  onRowClick?: (row: T) => void;
  mode?: "client" | "server";
  filterState?: DataTableFilterState;
  onFilterStateChange?: (next: DataTableFilterState) => void;
  pagination?: DataTablePagination;
  loading?: boolean;
  toolbarExtra?: ReactNode;
  caption?: string;
}) {
  const mapped: Array<DataTableColumn<T>> = columns.map((col, index) => ({
    id: col.key,
    header: col.header,
    cell: col.cell,
    className: col.className,
    filter: col.filter ?? "text",
    filterOptions: col.filterOptions,
    accessorKey: col.accessorKey,
    filterValue: col.filterValue,
    enableSorting: col.enableSorting,
    sticky: index === 0,
  }));

  return (
    <DataTable
      columns={mapped}
      rows={rows}
      mode={mode}
      filterState={filterState}
      onFilterStateChange={onFilterStateChange}
      emptyTitle={empty}
      onRowClick={onRowClick}
      pagination={pagination}
      loading={loading}
      toolbarExtra={toolbarExtra}
      caption={caption}
    />
  );
}
