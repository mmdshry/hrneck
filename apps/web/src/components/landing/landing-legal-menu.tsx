"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Desktop "Legal" disclosure for the landing header. Opens on click (not
 * hover) so it works on touch screens. Closes on outside pointer-down,
 * Escape (focus returns to the trigger), or when a link is chosen.
 */
export function LandingLegalMenu({ className }: { className?: string }) {
  const t = useTranslations("legal");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      const target = event.target;
      if (target instanceof Node && root?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const linkClassName =
    "flex min-h-11 items-center rounded-[calc(var(--radius)-2px)] px-[var(--space-md)] text-sm text-[var(--foreground)] transition-colors duration-[var(--motion)] hover:bg-[var(--muted)]";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius)] px-[var(--space-md)] py-[var(--space-sm)] text-sm text-[var(--muted-foreground)] transition-colors duration-[var(--motion)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      >
        {t("legalLabel")}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-[var(--motion)]",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-50 mt-2 flex min-w-56 flex-col gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow-md)]"
        >
          <Link
            href="/privacy"
            className={linkClassName}
            onClick={() => setOpen(false)}
          >
            {t("privacyPolicy")}
          </Link>
          <Link
            href="/terms"
            className={linkClassName}
            onClick={() => setOpen(false)}
          >
            {t("termsOfService")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
