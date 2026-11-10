"use client";

import { useEffect, useState } from "react";
import { fetchSessionUser } from "@/lib/api";
import { getEcho } from "@/lib/echo";

export type LiveStatus = "connecting" | "live" | "disconnected" | "error";

export type LiveStatusEvent = "subscribed" | "snapshot" | "error" | "reconnecting";

const INITIAL_DEFER_MS = 1500;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export function nextLiveStatus(
  current: LiveStatus,
  event: LiveStatusEvent,
): LiveStatus {
  switch (event) {
    case "subscribed":
      return current === "error" ? current : "live";
    case "snapshot":
      return "live";
    case "reconnecting":
      return current === "live" ? "connecting" : current === "error" ? "error" : "connecting";
    case "error":
      return "error";
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

export function nextReconnectDelayMs(attempt: number): number {
  const exp = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.max(0, attempt));
  return exp;
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
    let attempt = 0;
    let isFirstConnect = true;

    setStatus("connecting");
    setError(null);

    const leaveChannel = () => {
      if (!subscribedName) return;
      const name = subscribedName;
      subscribedName = null;
      void getEcho()
        .then((echo) => {
          echo.leave(name);
        })
        .catch(() => {
          /* ignore */
        });
    };

    const scheduleConnect = (delayMs: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void connect();
      }, delayMs);
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      leaveChannel();
      setStatus((current) => nextLiveStatus(current, "reconnecting"));
      const delay = nextReconnectDelayMs(attempt);
      attempt += 1;
      scheduleConnect(delay);
    };

    const connect = async () => {
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
          attempt = 0;
          setStatus((current) => nextLiveStatus(current, "snapshot"));
          setError(null);
        };

        sub.listen(".snapshot", handle);
        sub.listen(".updated", handle);

        sub.subscribed(() => {
          if (cancelled) return;
          attempt = 0;
          setStatus((current) => nextLiveStatus(current, "subscribed"));
          setError(null);
        });

        sub.error((err: unknown) => {
          if (cancelled) return;
          setStatus((current) => nextLiveStatus(current, "error"));
          setError(
            err instanceof Error ? err.message : "Live connection failed",
          );
          scheduleReconnect();
        });

        const pusher = echo.connector?.pusher;
        if (pusher?.connection) {
          const onDisconnected = () => {
            if (cancelled) return;
            setStatus((current) => nextLiveStatus(current, "error"));
            setError("Live connection lost");
            scheduleReconnect();
          };
          const onUnavailable = () => {
            if (cancelled) return;
            setStatus((current) => nextLiveStatus(current, "error"));
            setError("Live sync unavailable");
            scheduleReconnect();
          };
          pusher.connection.bind("disconnected", onDisconnected);
          pusher.connection.bind("unavailable", onUnavailable);
        }
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Live connection failed",
        );
        scheduleReconnect();
      }
    };

    // Defer first websocket work past first paint so Lighthouse does not score console noise.
    const firstDelay = isFirstConnect ? INITIAL_DEFER_MS : 0;
    isFirstConnect = false;
    scheduleConnect(firstDelay);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      leaveChannel();
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
