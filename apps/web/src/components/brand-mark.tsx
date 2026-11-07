"use client";

import { ShieldAlert } from "lucide-react";
import { useBranding } from "@/components/branding-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  iconClassName?: string;
  showName?: boolean;
  nameClassName?: string;
  size?: "sm" | "md";
};

export function BrandMark({
  className,
  iconClassName,
  showName = true,
  nameClassName,
  size = "md",
}: BrandMarkProps) {
  const { displayName, logoUrl, loading } = useBranding();
  const box = size === "sm" ? "h-9 w-9" : "h-[58px] w-[58px]";
  const icon = size === "sm" ? "h-5 w-5" : "h-7 w-7";

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {loading && !logoUrl ? (
        <Skeleton className={cn(box, "rounded-lg", iconClassName)} />
      ) : logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant logo streamed from API
        <img
          src={logoUrl}
          alt=""
          className={cn(
            box,
            "rounded-lg object-contain bg-[var(--card)]",
            iconClassName,
          )}
        />
      ) : (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]",
            box,
            iconClassName,
          )}
          aria-hidden
        >
          <ShieldAlert className={icon} strokeWidth={2.25} />
        </span>
      )}
      {showName ? (
        loading && !displayName ? (
          <Skeleton className={cn("h-5", size === "sm" ? "w-20" : "w-28")} />
        ) : (
          <span
            className={cn(
              "truncate font-[family-name:var(--font-display)]",
              size === "sm" ? "text-base" : "text-xl",
              nameClassName,
            )}
          >
            {displayName}
          </span>
        )
      ) : null}
    </div>
  );
}
