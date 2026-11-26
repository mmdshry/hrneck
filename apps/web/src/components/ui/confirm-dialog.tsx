"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown while the confirm action is running. */
  workingLabel?: string;
  /** Shown when onConfirm rejects without an Error message. */
  errorFallback?: string;
  /** Accessible name for the header close button. */
  closeLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  /** When false, backdrop click does not dismiss (recommended for destructive). */
  dismissible?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  workingLabel = "Working…",
  errorFallback = "Something went wrong. Please try again.",
  closeLabel,
  variant = "default",
  loading: loadingProp,
  dismissible,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = loadingProp ?? busy;
  const canDismiss = dismissible ?? variant !== "destructive";

  function closeWith(next: boolean) {
    setError(null);
    onOpenChange(next);
  }

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
      closeWith(false);
    } catch (err) {
      // Keep the dialog open and show why, so the user can retry or cancel.
      setError(err instanceof Error && err.message ? err.message : errorFallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={closeWith}
      title={title}
      description={description}
      role={variant === "destructive" ? "alertdialog" : "dialog"}
      closeLabel={closeLabel}
      dismissible={canDismiss && !loading}
      busy={loading}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => closeWith(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "primary"}
            disabled={loading}
            onClick={() => void handleConfirm()}
          >
            {loading ? workingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
