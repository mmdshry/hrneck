import { cn } from "@/lib/utils";

type MinimalLoaderProps = {
  className?: string;
  label?: string;
};

export function MinimalLoader({
  className,
  label = "Loading",
}: MinimalLoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex min-h-24 w-full flex-col items-center justify-center gap-3 py-8",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--muted-foreground)]/25 border-t-[var(--foreground)]"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
