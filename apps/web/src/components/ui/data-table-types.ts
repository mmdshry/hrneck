import type { ReactNode } from "react";

export type DataTableFilterVariant = "text" | "select" | "none";

export type DataTableFilterOption = {
  label: string;
  value: string;
};

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Render cell contents. */
  cell: (row: T) => ReactNode;
  /** Value used for client-mode filter/sort/search when not using accessorKey. */
  filterValue?: (row: T) => unknown;
  /** Flat object key used as default filter/search value in client mode. */
  accessorKey?: keyof T & string;
  className?: string;
  headerClassName?: string;
  enableSorting?: boolean;
  enableGlobalFilter?: boolean;
  filter?: DataTableFilterVariant;
  filterOptions?: DataTableFilterOption[];
  filterPlaceholder?: string;
  /** Sticky first data column (usually first visible column). */
  sticky?: boolean;
};

export type DataTableMode = "client" | "server";

export type DataTablePagination = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: import("@/lib/pagination").PageSize) => void;
};
