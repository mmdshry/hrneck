"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { getEcho } from "@/lib/echo";
import { notificationsLiveChannel } from "@/lib/live-topics";
import {
  type NotificationsResponse,
  type UserNotificationItem,
} from "@/lib/notifications";
import { resolveTenant } from "@/lib/tenant";
import { toastNotification } from "@/lib/toast";
import { cn } from "@/lib/utils";

const INBOX_PATH = "/org/notifications";

type NotificationsLivePayload = {
  data?: UserNotificationItem[];
  meta?: { unread_count?: number; total?: number };
};

type NotificationBellProps = {
  className?: string;
  href?: string;
};

export function NotificationBell({
  className,
  href = INBOX_PATH,
}: NotificationBellProps) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [userId, setUserId] = useState<number | null>(null);
  const [tenant, setTenant] = useState<string | null>(null);
  const onInbox = pathname === INBOX_PATH || pathname.startsWith(`${INBOX_PATH}/`);

  const channel = useMemo(
    () =>
      tenant && userId !== null
        ? notificationsLiveChannel(tenant, userId)
        : null,
    [tenant, userId],
  );

  const onPayload = useCallback((payload: NotificationsLivePayload) => {
    const count = payload.meta?.unread_count;
    if (typeof count === "number") {
      setUnread(count);
    }
  }, []);

  useLiveTopic<NotificationsLivePayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const session = await fetchSessionUser();
        if (!session) {
          setUnread(0);
          setUserId(null);
          return;
        }
        setUserId(session.id);
        const t = resolveTenant() || session.tenant_id;
        if (!t) return;
        setTenant(t);
        const res = await api<NotificationsResponse>(
          "/api/v1/org/notifications?per_page=1",
          { tenant: t },
        );
        setUnread(res.meta.unread_count);
      } catch {
        /* keep last good state */
      }
    })();
  }, [pathname]);

  useEffect(() => {
    if (!userId || !tenant) return;
    let cancelled = false;
    let channelName: string | null = null;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const echo = await getEcho();
          if (cancelled) return;
          channelName = notificationsLiveChannel(tenant, userId);
          const sub = echo.private(channelName);
          sub.listen(
            ".notification.created",
            (payload: { data?: UserNotificationItem }) => {
              if (cancelled || !payload?.data) return;
              setUnread((n) => n + 1);
              if (!onInbox && document.visibilityState === "visible") {
                toastNotification(
                  payload.data.title,
                  payload.data.body ?? undefined,
                );
              }
            },
          );
        } catch {
          /* live topic snapshot/updated still covers unread */
        }
      })();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (channelName) {
        void getEcho()
          .then((echo) => echo.leave(channelName!))
          .catch(() => undefined);
      }
    };
  }, [userId, tenant, onInbox]);

  const statusLabel =
    unread === 0
      ? "No unread notifications"
      : unread === 1
        ? "1 unread notification"
        : `${unread} unread notifications`;

  return (
    <div className={cn("relative", className)}>
      <Link
        href={href}
        aria-label="Notifications"
        aria-current={onInbox ? "page" : undefined}
        className={cn(
          "relative inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-sm)] transition-colors duration-[var(--motion)] hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          onInbox && "border-[var(--primary)] ring-1 ring-[var(--primary)]",
        )}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-semibold text-[var(--destructive-foreground)]"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
      <span className="sr-only" role="status" aria-atomic="true">
        {statusLabel}
      </span>
    </div>
  );
}
