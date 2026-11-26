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
  size?: "sm" | "md" | "lg";
};

function logoBoxClass(size: "sm" | "md" | "lg", logoOnly: boolean): string {
  switch (size) {
    case "lg":
      // Sidebar width is ~15rem; fill it and allow a tall mark when logo-only.
      return logoOnly ? "h-24 w-full max-h-24" : "h-20 w-20";
    case "sm":
      return "h-9 w-9";
    case "md":
      return "h-[58px] w-[58px]";
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}

function wordmarkHeightClass(size: "sm" | "md" | "lg"): string {
  switch (size) {
    case "sm":
      return "h-7";
    case "md":
      return "h-9";
    case "lg":
      return "h-10";
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}

function nameTextClass(size: "sm" | "md" | "lg"): string {
  switch (size) {
    case "sm":
      return "text-base";
    case "md":
      return "text-xl";
    case "lg":
      return "text-2xl";
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}

export function BrandMark({
  className,
  iconClassName,
  showName = true,
  nameClassName,
  size = "md",
}: BrandMarkProps) {
  const { displayName, logoUrl, loading } = useBranding();
  const wordmarkHeight = wordmarkHeightClass(size);
  const logoOnly = !showName;
  const box = logoBoxClass(size, logoOnly);
  const nameText = nameTextClass(size);

  if (loading && !logoUrl) {
    return (
      <div className={cn("flex min-w-0 items-center", className)}>
        <Skeleton
          className={cn(
            logoOnly && size === "lg" ? "h-24 w-full" : wordmarkHeight,
            logoOnly && size === "lg" ? undefined : "w-28",
            "rounded-[var(--radius)]",
            iconClassName,
          )}
        />
      </div>
    );
  }

  if (logoUrl) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center",
          logoOnly ? "w-full" : "gap-2",
          className,
        )}
      >
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
                nameText,
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

  // Without a custom logo: optional white-label name, else HRneck wordmark.
  // showName=false never renders the text name (sidebar logo-only mode).
  if (showName && displayName.trim() !== "" && displayName !== "HRneck") {
    return (
      <div className={cn("flex min-w-0 items-center", className)}>
        <span
          className={cn(
            "truncate font-[family-name:var(--font-display)]",
            nameText,
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
