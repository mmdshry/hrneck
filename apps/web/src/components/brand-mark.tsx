"use client";

import { useBranding } from "@/components/branding-provider";
import { HrneckWordmark } from "@/components/hrneck-wordmark";
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
  const wordmarkHeight = size === "sm" ? "h-7" : "h-9";
  const box = size === "sm" ? "h-9 w-9" : "h-[58px] w-[58px]";

  if (loading && !logoUrl) {
    return (
      <div className={cn("flex min-w-0 items-center", className)}>
        <Skeleton className={cn(wordmarkHeight, "w-28 rounded-[var(--radius)]", iconClassName)} />
      </div>
    );
  }

  if (logoUrl) {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant logo streamed from API */}
        <img
          src={logoUrl}
          alt=""
          className={cn(
            box,
            "rounded-[var(--radius)] bg-[var(--card)] object-contain",
            iconClassName,
          )}
        />
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

  // Without a custom logo, show the org display name when white-labeled;
  // otherwise keep the default HRNECK wordmark.
  if (showName && displayName.trim() !== "" && displayName !== "HRNECK") {
    return (
      <div className={cn("flex min-w-0 items-center", className)}>
        <span
          className={cn(
            "truncate font-[family-name:var(--font-display)]",
            size === "sm" ? "text-base" : "text-xl",
            nameClassName,
          )}
        >
          {displayName}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      <HrneckWordmark className={cn(wordmarkHeight, iconClassName)} />
    </div>
  );
}
