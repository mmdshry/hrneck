"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  type PageSize,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

export type PaginationProps = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: PageSize) => void;
  className?: string;
};

export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  className,
}: PaginationProps) {
  const safePerPage = perPage > 0 ? perPage : DEFAULT_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(total / safePerPage) || 1);
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const from = total === 0 ? 0 : (currentPage - 1) * safePerPage + 1;
  const to = total === 0 ? 0 : Math.min(currentPage * safePerPage, total);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span className="whitespace-nowrap">Rows</span>
          <Select
            className="w-auto min-w-[4.5rem]"
            value={String(safePerPage)}
            onChange={(event) => {
              const next = Number(event.target.value) as PageSize;
              onPerPageChange(next);
            }}
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </Button>
        <span className="min-w-[5.5rem] text-center text-sm text-[var(--foreground)]">
          Page {currentPage} / {lastPage}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
