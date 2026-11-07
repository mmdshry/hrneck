"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  loading?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
};

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Value",
  defaultValue = "",
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  placeholder,
  loading: loadingProp,
  onSubmit,
}: PromptDialogProps) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const loading = loadingProp ?? busy;

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (!next) {
      return;
    }
    try {
      setBusy(true);
      await onSubmit(next);
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
      dismissible={!loading}
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
            type="submit"
            form={`${inputId}-form`}
            variant="primary"
            disabled={loading || !value.trim()}
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <form id={`${inputId}-form`} onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          disabled={loading}
          required
        />
      </form>
    </Dialog>
  );
}
