"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";

type AvatarUploaderProps = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  /** POST/DELETE endpoint, e.g. /api/v1/auth/avatar or /api/v1/org/targets/3/avatar */
  endpoint: string;
  /** Include X-Tenant for org endpoints */
  withTenant?: boolean;
  size?: "sm" | "md" | "lg";
  /** inline = avatar + buttons; dialog = clickable avatar opens modal */
  variant?: "inline" | "dialog";
  onChanged?: (nextUrl: string | null) => void;
  disabled?: boolean;
};

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
  if (fromEmail) return fromEmail.slice(0, 2).toUpperCase();
  return "";
}

export function AvatarUploader({
  name,
  email,
  avatarUrl,
  endpoint,
  withTenant = false,
  size = "lg",
  variant = "inline",
  onChanged,
  disabled = false,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    setPreviewUrl(avatarUrl ?? null);
  }, [avatarUrl]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      const body = new FormData();
      body.append("file", file);
      const res = await api<{ data: { avatar_url?: string | null } }>(endpoint, {
        method: "POST",
        tenant: withTenant ? resolveTenant() : undefined,
        body,
      });
      const next = res.data?.avatar_url ?? null;
      setPreviewUrl(next ? `${next}?t=${Date.now()}` : null);
      onChanged?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      await api(endpoint, {
        method: "DELETE",
        tenant: withTenant ? resolveTenant() : undefined,
      });
      setPreviewUrl(null);
      onChanged?.(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      disabled={disabled || busy}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void upload(file);
      }}
    />
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Working…" : previewUrl ? "Change photo" : "Upload photo"}
      </Button>
      {previewUrl ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => void remove()}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );

  if (variant === "dialog") {
    const initials = initialsFrom(name, email);
    // Visible initials must appear in the accessible name (axe label-content-name-mismatch).
    const ariaLabel = initials
      ? `Change profile photo ${initials}`
      : "Change profile photo";

    return (
      <>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:opacity-50"
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
        >
          <Avatar src={previewUrl} name={name} email={email} size={size} />
        </button>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Profile photo"
          description="Upload a new photo or remove the current one."
          size="sm"
        >
          <div className="flex flex-col items-center gap-4">
            <Avatar src={previewUrl} name={name} email={email} size="lg" />
            {fileInput}
            {actionButtons}
            {error ? (
              <p className="w-full text-center text-sm text-[var(--destructive)]">
                {error}
              </p>
            ) : null}
          </div>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Avatar src={previewUrl} name={name} email={email} size={size} />
      {fileInput}
      {actionButtons}
      {error ? <p className="w-full text-sm text-[var(--destructive)]">{error}</p> : null}
    </div>
  );
}
