import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  icon: Icon,
  children,
  className,
  as: Tag = "h2",
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  as?: "h2" | "h3" | "p";
}) {
  return (
    <Tag
      className={cn(
        "flex items-center gap-2 text-base font-semibold text-[var(--foreground)]",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
      {children}
    </Tag>
  );
}

export function GuideIconBadge({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--primary)]",
        className,
      )}
      aria-hidden
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}
