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
  /** Narrow sidebars / cards: shorter summary and stacked controls. */
  compact?: boolean;
};

export function Pagination({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  className,
  compact = false,
}: PaginationProps) {
  if (total === 0) {
    return null;
  }

  const safePerPage = perPage > 0 ? perPage : DEFAULT_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(total / safePerPage) || 1);
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const from = (currentPage - 1) * safePerPage + 1;
  const to = Math.min(currentPage * safePerPage, total);

  return (
    <div
      className={cn(
        "border-t border-[var(--border)] pt-3",
        compact
          ? "flex flex-col gap-2"
          : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        {compact ? (
          <span className="whitespace-nowrap">
            {from}–{to} of {total}
          </span>
        ) : (
          <>
            Showing {from}–{to} of {total}
          </>
        )}
      </p>
      <div
        className={cn(
          "flex items-center gap-2",
          compact ? "flex-col items-stretch" : "flex-wrap",
        )}
      >
        <label
          className={cn(
            "flex items-center gap-2 text-sm text-[var(--muted-foreground)]",
            compact && "justify-between",
          )}
        >
          <span className="whitespace-nowrap">Rows</span>
          <Select
            className={cn("w-auto min-w-[4.5rem]", compact && "flex-1")}
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
        <div
          className={cn(
            "flex items-center gap-2",
            compact && "w-full justify-between",
          )}
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(compact && "flex-1")}
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            {compact ? "Prev" : "Previous"}
          </Button>
          <span
            className={cn(
              "text-center text-sm text-[var(--foreground)]",
              compact ? "shrink-0 whitespace-nowrap px-1" : "min-w-[5.5rem]",
            )}
          >
            {compact
              ? `${currentPage}/${lastPage}`
              : `Page ${currentPage} / ${lastPage}`}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn(compact && "flex-1")}
            disabled={currentPage >= lastPage}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
