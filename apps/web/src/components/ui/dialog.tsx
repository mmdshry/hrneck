"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  /** When false, backdrop click does not close (Escape / explicit close still work). */
  dismissible?: boolean;
  /** While true (in-flight request), Escape, the close button and backdrop clicks are ignored. */
  busy?: boolean;
  /** `alertdialog` marks destructive confirmations for assistive tech. */
  role?: "dialog" | "alertdialog";
  /** Element to focus on open. Defaults to the first control in the body, then the footer. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Accessible name for the header close button. */
  closeLabel?: string;
  className?: string;
};

const sizeClass: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-3xl",
  full: "max-w-6xl max-h-[100dvh] rounded-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-[var(--radius)]",
};

function firstFocusable(root: HTMLElement | null): HTMLElement | null {
  if (!root) {
    return null;
  }
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  return nodes.find((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1) ?? null;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
  busy = false,
  role = "dialog",
  initialFocusRef,
  closeLabel = "Close",
  className,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Keep latest callback without re-running open-focus when parents pass an
  // inline onOpenChange (e.g. typing in a controlled input re-renders).
  const onOpenChangeRef = useRef(onOpenChange);
  const busyRef = useRef(busy);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const initial =
      initialFocusRef?.current ??
      firstFocusable(bodyRef.current) ??
      firstFocusable(footerRef.current) ??
      panelRef.current;
    initial?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busyRef.current) {
          onOpenChangeRef.current(false);
        }
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

      if (nodes.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, initialFocusRef]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  function onBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!dismissible || busy) {
      return;
    }
    if (event.target === event.currentTarget) {
      onOpenChange(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onBackdropClick}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "motion-safe:animate-[hrneck-dialog-in_180ms_ease-out] relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-md)] outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-[var(--radius)]",
          sizeClass[size],
          className,
        )}
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
        </div>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div className="min-w-0 space-y-1">
            <h2
              id={titleId}
              className="text-base font-semibold tracking-tight text-[var(--foreground)]"
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="text-sm text-[var(--muted-foreground)]"
              >
                {description}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={closeLabel}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        {children ? (
          <div
            ref={bodyRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
          >
            {children}
          </div>
        ) : null}
        {footer ? (
          <div
            ref={footerRef}
            className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--border)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:px-5"
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
