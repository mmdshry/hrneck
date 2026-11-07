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
  variant = "default",
  loading: loadingProp,
  dismissible,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const loading = loadingProp ?? busy;
  const canDismiss = dismissible ?? variant !== "destructive";

  async function handleConfirm() {
    try {
      setBusy(true);
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Caller surfaces errors (toast/message); keep dialog open.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      dismissible={canDismiss && !loading}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "primary"}
            disabled={loading}
            onClick={() => void handleConfirm()}
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
