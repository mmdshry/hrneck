import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  actions?: ReactNode;
};

export function Panel({
  title,
  actions,
  className,
  children,
  ...props
}: PanelProps) {
  const hasHeader = Boolean(title || actions);

  if (!hasHeader) {
    return (
      <div
        className={cn(
          "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-sm)]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-sm)]",
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        {title ? (
          <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
            {title}
          </h2>
        ) : (
          <span />
        )}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
