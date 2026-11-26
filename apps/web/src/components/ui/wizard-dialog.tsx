"use client";

import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, type DialogSize } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
  /** Runs before advancing (or submitting on the last step). Return false to stay on the step. */
  validate?: () => boolean | Promise<boolean>;
  /** Renders the step body. Keep form state in the parent so it survives step changes. */
  render: () => ReactNode;
};

export type WizardLabels = {
  close: string;
  cancel: string;
  back: string;
  next: string;
  submit: string;
  progress: string;
  /** Formats the step position, e.g. "Step 2 of 3". `current` is 1-based. */
  stepCounter: (current: number, total: number) => string;
  discardMessage: string;
  keepEditing: string;
  discard: string;
};

export type WizardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: WizardStep[];
  /** Called when the last step is valid. The caller closes the wizard on success; errors should be surfaced by the caller. */
  onSubmit: () => void | Promise<void>;
  labels: WizardLabels;
  size?: DialogSize;
  /** External in-flight state (e.g. a parent request). Blocks navigation and closing. */
  busy?: boolean;
  /** When true, closing asks for confirmation before data is discarded. */
  isDirty?: boolean;
  className?: string;
};

export function WizardDialog({
  open,
  onOpenChange,
  title,
  steps,
  onSubmit,
  labels,
  size = "lg",
  busy = false,
  isDirty = false,
  className,
}: WizardDialogProps) {
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Reset to the first step whenever the wizard opens (state-from-props pattern, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setIndex(0);
      setConfirmingDiscard(false);
    }
  }

  const total = steps.length;
  const current = Math.min(index, Math.max(total - 1, 0));
  const step = steps[current];
  const isLast = current === total - 1;
  const working = busy || pending;

  function requestClose() {
    if (working) {
      return;
    }
    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }
    onOpenChange(false);
  }

  async function advance() {
    if (working || !step) {
      return;
    }
    setPending(true);
    try {
      const valid = step.validate ? await step.validate() : true;
      if (!valid) {
        return;
      }
      if (isLast) {
        await onSubmit();
      } else {
        setIndex(current + 1);
      }
    } catch {
      // The caller surfaces submit errors (toast or inline message); keep the wizard open.
    } finally {
      setPending(false);
    }
  }

  if (!step) {
    return null;
  }

  const counter = labels.stepCounter(current + 1, total);

  const footer = confirmingDiscard ? (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p role="status" className="text-sm text-[var(--foreground)]">
        {labels.discardMessage}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="secondary" onClick={() => setConfirmingDiscard(false)}>
          {labels.keepEditing}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setConfirmingDiscard(false);
            onOpenChange(false);
          }}
        >
          {labels.discard}
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Button type="button" variant="ghost" disabled={working} onClick={requestClose}>
        {labels.cancel}
      </Button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {current > 0 ? (
          <Button
            type="button"
            variant="secondary"
            disabled={working}
            onClick={() => setIndex(current - 1)}
          >
            {labels.back}
          </Button>
        ) : null}
        <Button type="button" disabled={working} onClick={() => void advance()}>
          {isLast ? labels.submit : labels.next}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          requestClose();
        }
      }}
      title={title}
      size={size}
      busy={working}
      closeLabel={labels.close}
      className={className}
      footer={footer}
    >
      <nav aria-label={labels.progress}>
        <ol className="mb-4 flex items-center gap-2">
          {steps.map((item, stepIndex) => {
            const isCurrent = stepIndex === current;
            const isComplete = stepIndex < current;
            return (
              <li
                key={item.id}
                aria-current={isCurrent ? "step" : undefined}
                className="flex min-w-0 flex-1 items-center gap-2 last:flex-none"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCurrent && "bg-[var(--primary)] text-[var(--primary-foreground)]",
                    isComplete && "bg-[var(--muted)] text-[var(--foreground)]",
                    !isCurrent &&
                      !isComplete &&
                      "border border-[var(--border)] text-[var(--muted-foreground)]",
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden /> : stepIndex + 1}
                </span>
                <span
                  className={cn(
                    "hidden min-w-0 truncate text-xs sm:block",
                    isCurrent
                      ? "font-semibold text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)]",
                  )}
                >
                  {item.title}
                </span>
                {stepIndex < total - 1 ? (
                  <span aria-hidden className="hidden h-px flex-1 bg-[var(--border)] sm:block" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <p className="text-xs font-medium text-[var(--muted-foreground)]">{counter}</p>
      <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">{step.title}</h3>
      {step.description ? (
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{step.description}</p>
      ) : null}
      <div className="mt-4">{step.render()}</div>
    </Dialog>
  );
}
