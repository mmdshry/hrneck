"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { ensureCsrf } from "@/lib/api";

type EchoClient = Echo<"reverb">;

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: EchoClient;
  }
}

function xsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function reverbConfig() {
  return {
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? "hrneck-reverb-key",
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST ?? "localhost",
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http") === "https",
    enabledTransports: ["ws", "wss"] as ("ws" | "wss")[],
  };
}

export async function getEcho(): Promise<EchoClient> {
  if (typeof window === "undefined") {
    throw new Error("Echo is browser-only");
  }

  await ensureCsrf();

  if (window.Echo) {
    return window.Echo;
  }

  window.Pusher = Pusher;
  // Keep LHCI Best Practices clean — connection failures stay in React state.
  Pusher.logToConsole = false;

  const cfg = reverbConfig();
  const echo = new Echo({
    broadcaster: "reverb",
    key: cfg.key,
    wsHost: cfg.wsHost,
    wsPort: cfg.wsPort,
    wssPort: cfg.wssPort,
    forceTLS: cfg.forceTLS,
    enabledTransports: cfg.enabledTransports,
    authEndpoint: "/broadcasting/auth",
    auth: {
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(xsrfToken() ? { "X-XSRF-TOKEN": xsrfToken()! } : {}),
      },
    },
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        const token = xsrfToken();
        void fetch("/broadcasting/auth", {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(token ? { "X-XSRF-TOKEN": token } : {}),
          },
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              const body = await response.text();
              callback(new Error(body || `Auth failed (${response.status})`), null);
              return;
            }
            const data = (await response.json()) as { auth: string; channel_data?: string; shared_secret?: string };
            callback(null, data);
          })
          .catch((error: unknown) => {
            callback(error instanceof Error ? error : new Error(String(error)), null);
          });
      },
    }),
  });

  window.Echo = echo;
  return echo;
}
