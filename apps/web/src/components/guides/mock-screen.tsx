import type { GuideMock } from "@/lib/guides/types";
import { cn } from "@/lib/utils";

export function MockScreen({
  mock,
  className,
}: {
  mock: GuideMock;
  className?: string;
}) {
  const progress = mock.highlight.progress;

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--muted)]" aria-hidden />
        <p className="ml-3 text-xs font-medium text-[var(--muted-foreground)]">
          {mock.chromeTitle}
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          {mock.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg bg-[var(--muted)] px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                {stat.label}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-sm tabular-nums text-[var(--foreground)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {mock.highlight.title}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {mock.highlight.caption}
          </p>
          {typeof progress === "number" ? (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${mock.highlight.title} progress`}
            >
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          ) : null}
        </div>
        <ul className="space-y-2">
          {mock.rows.map((row) => (
            <li
              key={`${row.title}-${row.meta}`}
              className="flex items-start justify-between gap-3 rounded-lg bg-[var(--muted)] px-3 py-2 text-xs"
            >
              <span className="font-medium text-[var(--foreground)]">{row.title}</span>
              <span className="shrink-0 text-[var(--muted-foreground)]">{row.meta}</span>
            </li>
          ))}
        </ul>
        {mock.annotations.length > 0 ? (
          <ul className="space-y-2 border-t border-[var(--border)] pt-3">
            {mock.annotations.map((annotation) => (
              <li key={annotation.label} className="text-xs">
                <span className="font-semibold text-[var(--primary)]">
                  {annotation.label}:
                </span>{" "}
                <span className="text-[var(--muted-foreground)]">{annotation.note}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <figcaption className="sr-only">
        Annotated mock screen for {mock.chromeTitle}
      </figcaption>
    </figure>
  );
}
