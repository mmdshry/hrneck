"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveTenant } from "@/lib/tenant";

function initialsFrom(name?: string | null, email?: string | null): string {
  const fromName = (name ?? "").trim();
  if (fromName) {
    const parts = fromName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
    }
    return fromName.slice(0, 2).toUpperCase();
  }
  const fromEmail = (email ?? "").trim();
  if (fromEmail) {
    return fromEmail.slice(0, 2).toUpperCase();
  }
  return "?";
}

/** Append ?tenant= for org avatar streams (<img> cannot send X-Tenant). */
export function resolveAvatarSrc(src?: string | null): string | null {
  if (!src) return null;
  if (src.startsWith("/api/v1/auth/")) return src;
  if (src.includes("tenant=")) return src;
  const tenant = resolveTenant();
  if (!tenant) return src;
  const sep = src.includes("?") ? "&" : "?";
  return `${src}${sep}tenant=${encodeURIComponent(tenant)}`;
}

type AvatarProps = {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  alt?: string;
};

const SIZE_CLASS = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
} as const;

export function Avatar({
  src,
  name,
  email,
  size = "md",
  className = "",
  alt,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = useMemo(() => initialsFrom(name, email), [name, email]);
  const resolved = useMemo(() => resolveAvatarSrc(src), [src]);
  const showImage = Boolean(resolved) && !failed;

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--muted)] font-medium text-[var(--foreground)] ${SIZE_CLASS[size]} ${className}`}
      aria-hidden={alt ? undefined : true}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolved}
          src={resolved!}
          alt={alt ?? ""}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}
