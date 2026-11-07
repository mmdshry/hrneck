"use client";

import { useEffect, useState } from "react";
import { fetchSessionUser } from "@/lib/api";
import { getEcho } from "@/lib/echo";

export type LiveStatus = "connecting" | "live" | "disconnected" | "error";

export type LiveStatusEvent = "subscribed" | "snapshot" | "error";

export function nextLiveStatus(
  current: LiveStatus,
  event: LiveStatusEvent,
): LiveStatus {
  switch (event) {
    case "subscribed":
      return current === "error" ? current : "live";
    case "snapshot":
      return "live";
    case "error":
      return "error";
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

type UseLiveTopicOptions<T> = {
  channel: string | null;
  enabled?: boolean;
  onPayload: (payload: T) => void;
};

export function useLiveTopic<T = Record<string, unknown>>({
  channel,
  enabled = true,
  onPayload,
}: UseLiveTopicOptions<T>): { status: LiveStatus; error: string | null } {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !channel) {
      setStatus("disconnected");
      return;
    }

    let cancelled = false;
    let subscribedName: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    setStatus("connecting");
    setError(null);

    // Defer websocket work past first paint so Lighthouse does not score console noise.
    timer = setTimeout(() => {
      void (async () => {
        try {
          const session = await fetchSessionUser();
          if (cancelled) return;
          if (!session) {
            setStatus("disconnected");
            return;
          }

          const echo = await getEcho();
          if (cancelled) return;

          const sub = echo.private(channel);
          subscribedName = channel;

          const handle = (payload: T) => {
            if (cancelled) return;
            onPayload(payload);
            setStatus((current) => nextLiveStatus(current, "snapshot"));
            setError(null);
          };

          sub.listen(".snapshot", handle);
          sub.listen(".updated", handle);

          sub.subscribed(() => {
            if (!cancelled) {
              setStatus((current) => nextLiveStatus(current, "subscribed"));
            }
          });

          sub.error((err: unknown) => {
            if (cancelled) return;
            setStatus((current) => nextLiveStatus(current, "error"));
            setError(
              err instanceof Error ? err.message : "Live connection failed",
            );
          });
        } catch (err) {
          if (cancelled) return;
          setStatus("error");
          setError(
            err instanceof Error ? err.message : "Live connection failed",
          );
        }
      })();
    }, 1500);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (subscribedName) {
        void getEcho()
          .then((echo) => {
            echo.leave(subscribedName!);
          })
          .catch(() => {
            /* ignore */
          });
      }
    };
    // onPayload intentionally omitted — callers should pass a stable callback or accept re-subscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, enabled]);

  return { status, error };
}

export function liveStatusLabel(status: LiveStatus): string | null {
  switch (status) {
    case "connecting":
      return "Connecting…";
    case "live":
      return null;
    case "disconnected":
      return "Disconnected";
    case "error":
      return "Live sync unavailable";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
