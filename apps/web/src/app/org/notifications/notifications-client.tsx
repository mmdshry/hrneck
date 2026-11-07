"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { notificationTypeIcon } from "@/components/notifications/notification-type-icon";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  notificationHref,
  type NotificationsResponse,
  type UserNotificationItem,
} from "@/lib/notifications";
import {
  DEFAULT_PAGE_SIZE,
  paginationQuery,
  type PageSize,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

type NotificationsMeta = NotificationsResponse["meta"];

const emptyNotificationsMeta = (perPage: number = DEFAULT_PAGE_SIZE): NotificationsMeta => ({
  current_page: 1,
  last_page: 1,
  per_page: perPage,
  total: 0,
  unread_count: 0,
});

export function NotificationsClient() {
  const router = useRouter();
  const [items, setItems] = useState<UserNotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationsMeta>(emptyNotificationsMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(
    async (nextPage = page, nextPerPage = perPage) => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        if (!me) {
          setItems([]);
          setMeta(emptyNotificationsMeta(nextPerPage));
          return;
        }
        const tenant = resolveTenant();
        const res = await api<NotificationsResponse>(
          `/api/v1/org/notifications?${paginationQuery(nextPage, nextPerPage)}`,
          { tenant },
        );
        setItems(res.data ?? []);
        setMeta(res.meta ?? emptyNotificationsMeta(nextPerPage));
        setPage(res.meta?.current_page ?? nextPage);
        setPerPage((res.meta?.per_page as PageSize) || nextPerPage);
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [page, perPage],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function markAllRead() {
    if (meta.unread_count === 0) return;
    setMarking(true);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      const res = await api<{ data: { unread_count: number } }>(
        "/api/v1/org/notifications/read",
        {
          method: "POST",
          tenant,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        },
      );
      setMeta((prev) => ({ ...prev, unread_count: res.data.unread_count }));
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          read_at: item.read_at ?? new Date().toISOString(),
        })),
      );
      toastSuccess("All notifications marked as read.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setMarking(false);
    }
  }

  async function openItem(item: UserNotificationItem) {
    if (!item.read_at) {
      try {
        await ensureCsrf();
        const tenant = resolveTenant();
        const res = await api<{ data: { unread_count: number } }>(
          "/api/v1/org/notifications/read",
          {
            method: "POST",
            tenant,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [item.id] }),
          },
        );
        setMeta((prev) => ({ ...prev, unread_count: res.data.unread_count }));
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? { ...row, read_at: row.read_at ?? new Date().toISOString() }
              : row,
          ),
        );
      } catch {
        /* still navigate */
      }
    }
    router.push(notificationHref(item));
  }

  if (loading) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description="Assignments, ticket updates, and organization announcements."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={meta.unread_count === 0 || marking}
            onClick={() => void markAllRead()}
            className="gap-1.5"
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            {marking ? "Updating…" : "Mark all read"}
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="You are all caught up"
          description="New assignments and announcements will show up here."
        />
      ) : (
        <>
          <ul className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {items.map((item) => {
              const Icon = notificationTypeIcon(item.type);
              const unreadItem = !item.read_at;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-3 px-1 py-4 text-left transition-colors hover:bg-[var(--muted)]/40",
                      unreadItem && "bg-[var(--muted)]/25",
                    )}
                    onClick={() => void openItem(item)}
                  >
                    <span
                      className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--foreground)]"
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{item.title}</span>
                        {item.created_at ? (
                          <time
                            dateTime={item.created_at}
                            className="shrink-0 text-xs text-[var(--muted-foreground)]"
                          >
                            {new Date(item.created_at).toLocaleString()}
                          </time>
                        ) : null}
                      </span>
                      {item.body ? (
                        <span className="mt-1 block whitespace-pre-wrap text-sm text-[var(--muted-foreground)]">
                          {item.body}
                        </span>
                      ) : null}
                      {unreadItem ? (
                        <span className="mt-2 inline-block text-xs font-medium text-[var(--accent)]">
                          Unread
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination
            className="mt-4"
            page={page}
            perPage={perPage}
            total={meta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
