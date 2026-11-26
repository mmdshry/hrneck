"use client";

import { useEffect, useRef } from "react";

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
};

type TurnstileWindow = Window & { turnstile?: TurnstileApi };

/** Loads Cloudflare's script once and resolves with its global API. */
function loadTurnstile(): Promise<TurnstileApi> {
  const win = window as TurnstileWindow;
  if (win.turnstile) return Promise.resolve(win.turnstile);

  return new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", () => {
      if (win.turnstile) {
        resolve(win.turnstile);
      } else {
        reject(new Error("Turnstile did not initialize"));
      }
    });
    script.addEventListener("error", () => {
      // Remove the failed tag so a later mount can retry the download.
      script?.remove();
      reject(new Error("Turnstile script failed to load"));
    });
  });
}

/**
 * Renders a Turnstile challenge and reports the token (or null when it is missing or expired).
 * Remount with a new `key` to get a fresh widget; Turnstile tokens are single-use.
 */
export function TurnstileWidget({
  siteKey,
  onTokenChange,
}: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let widgetId: string | null = null;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => onTokenChange(null),
        });
      })
      .catch(() => {
        if (!cancelled) onTokenChange(null);
      });

    return () => {
      cancelled = true;
      onTokenChange(null);
      const turnstile = (window as TurnstileWindow).turnstile;
      if (widgetId && turnstile) turnstile.remove(widgetId);
    };
  }, [siteKey, onTokenChange]);

  return <div ref={containerRef} className="min-h-[65px]" />;
}
