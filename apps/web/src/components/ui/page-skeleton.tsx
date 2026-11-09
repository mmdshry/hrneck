import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonProps = {
  className?: string;
  rows?: number;
  variant?: "list" | "detail" | "form";
};

export function PageSkeleton({
  className,
  rows = 5,
  variant = "list",
}: PageSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-10", className)}
    >
      <h1 className="sr-only">Loading</h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-8 w-48 md:h-9 md:w-64" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {variant === "detail" ? (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : null}

      {variant === "form" ? (
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          {Array.from({ length: Math.max(rows, 3) }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "list" ? (
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5 max-w-xs" />
                <Skeleton className="h-3 w-3/5 max-w-md" />
              </div>
              <Skeleton className="h-8 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
