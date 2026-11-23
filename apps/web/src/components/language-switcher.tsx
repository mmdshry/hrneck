"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { LocaleFlag } from "@/components/locale-flag";
import {
  localeOptions,
  type AppLocale,
  normalizeLocale,
} from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/set-locale";
import { api, ensureCsrf, patchSessionLocale } from "@/lib/api";
import { cn } from "@/lib/utils";

function subscribe() {
  return () => undefined;
}

type MenuCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
};

type Props = {
  className?: string;
  /** Compact trigger for headers; wider labeled trigger for settings. */
  variant?: "compact" | "list";
  /** Persist to API when the user is signed in. */
  persistToAccount?: boolean;
};

const MENU_GAP = 4;
const MENU_MIN_WIDTH = 176;
const VIEWPORT_PAD = 8;

export function LanguageSwitcher({
  className,
  variant = "compact",
  persistToAccount = true,
}: Props) {
  const t = useTranslations("language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = normalizeLocale(locale);
  const currentOption =
    localeOptions.find((opt) => opt.code === current) ?? localeOptions[0];
  const showLabel = variant === "list";

  async function applyLocale(next: AppLocale) {
    if (next === current) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await setLocaleCookie(next);
    if (persistToAccount) {
      try {
        await ensureCsrf();
        await api("/api/v1/auth/locale", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
        patchSessionLocale(next);
      } catch {
        // Guest or unauthenticated — cookie alone is enough.
      }
    }
    startTransition(() => {
      router.refresh();
    });
  }

  function updateMenuPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const preferredHeight = Math.min(256, localeOptions.length * 42 + 8);
    const openUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(preferredHeight, openUp ? spaceAbove - MENU_GAP : spaceBelow - MENU_GAP),
    );
    const width = Math.max(rect.width, showLabel ? rect.width : MENU_MIN_WIDTH);
    let left = showLabel ? rect.left : rect.right - width;
    left = Math.min(
      Math.max(VIEWPORT_PAD, left),
      window.innerWidth - width - VIEWPORT_PAD,
    );

    setMenuCoords({
      top: openUp ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left,
      width,
      maxHeight,
      openUp,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuCoords(null);
      return;
    }
    updateMenuPosition();
    function onReposition() {
      updateMenuPosition();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
    // showLabel is used inside updateMenuPosition via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open gates the effect
  }, [open, showLabel]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const root = rootRef.current;
      const list = listRef.current;
      const target = event.target as Node;
      if (root?.contains(target) || list?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!mounted || !currentOption) {
    return (
      <div
        className={cn("inline-flex items-center gap-1", className)}
        aria-hidden
      >
        <LocaleFlag locale="en" className="h-3.5 w-5" />
      </div>
    );
  }

  const select = (
    <div
      ref={rootRef}
      className={cn("relative inline-flex", showLabel && "w-full")}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={pending}
        aria-label={t("label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-9 items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] px-2.5 text-sm transition-colors hover:bg-[var(--muted)]",
          showLabel ? "w-full justify-between" : "justify-center",
          pending && "opacity-60",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <LocaleFlag locale={currentOption.code} title={currentOption.label} />
          {showLabel ? <span>{currentOption.label}</span> : null}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && menuCoords ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t("label")}
          style={{
            position: "fixed",
            top: menuCoords.openUp ? undefined : menuCoords.top,
            bottom: menuCoords.openUp
              ? window.innerHeight - menuCoords.top
              : undefined,
            left: menuCoords.left,
            width: menuCoords.width,
            maxHeight: menuCoords.maxHeight,
            zIndex: 80,
          }}
          className="overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-1 shadow-[var(--shadow-md)]"
        >
          {localeOptions.map((opt) => {
            const selected = opt.code === current;
            return (
              <li key={opt.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={pending}
                  onClick={() => void applyLocale(opt.code)}
                  className={cn(
                    "flex w-full min-h-10 items-center gap-2 rounded-[calc(var(--radius)-2px)] px-2.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-[var(--muted)] font-medium"
                      : "hover:bg-[var(--muted)]",
                  )}
                >
                  <LocaleFlag locale={opt.code} title={opt.label} />
                  <span>{opt.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );

  if (!showLabel) {
    return <div className={cn(className)}>{select}</div>;
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {t("preferred")}
        </p>
        <p className="text-sm text-[var(--muted-foreground)]">{t("choose")}</p>
      </div>
      {select}
    </div>
  );
}
