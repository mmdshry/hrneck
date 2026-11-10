"use client";

import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notificationTypeIcon } from "@/components/notifications/notification-type-icon";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { notificationsLiveChannel } from "@/lib/live-topics";
import {
  notificationHref,
  type NotificationsResponse,
  type UserNotificationItem,
} from "@/lib/notifications";
import {
  DEFAULT_PAGE_SIZE,
  paginateLocal,
  paginationQuery,
  type PageSize,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

type NotificationsMeta = NotificationsResponse["meta"];

type NotificationsLivePayload = {
  data?: UserNotificationItem[];
  meta?: { unread_count?: number; total?: number };
};

const emptyNotificationsMeta = (
  perPage: number = DEFAULT_PAGE_SIZE,
): NotificationsMeta => ({
  current_page: 1,
  last_page: 1,
  per_page: perPage,
  total: 0,
  unread_count: 0,
});

function matchesCells(
  q: string,
  columnFilters: Record<string, string>,
  cells: Record<string, string>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle && !Object.values(cells).join(" ").toLowerCase().includes(needle)) {
    return false;
  }
  for (const [key, raw] of Object.entries(columnFilters)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
  }
  return true;
}

function notificationCells(item: UserNotificationItem): Record<string, string> {
  return {
    title: item.title,
    body: item.body ?? "",
    unread: item.read_at ? "0" : "1",
  };
}

export function NotificationsClient() {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);
  const [tenant, setTenant] = useState<string | null>(null);
  const [liveItems, setLiveItems] = useState<UserNotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<UserNotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationsMeta>(emptyNotificationsMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);
  const unreadCountRef = useRef(unreadCount);

  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const channel = useMemo(
    () =>
      tenant && userId !== null
        ? notificationsLiveChannel(tenant, userId)
        : null,
    [tenant, userId],
  );

  const applySlice = useCallback(
    (
      rows: UserNotificationItem[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
      unread: number,
    ) => {
      const filtered = rows.filter((row) =>
        matchesCells(q, columnFilters, notificationCells(row)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setItems(sliced.data);
      setMeta({
        ...sliced.meta,
        unread_count: unread,
      });
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: NotificationsLivePayload) => {
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const unread =
      typeof payload.meta?.unread_count === "number"
        ? payload.meta.unread_count
        : rows.filter((r) => !r.read_at).length;
    setLiveItems(rows);
    setUnreadCount(unread);
  }, []);

  const { status } = useLiveTopic<NotificationsLivePayload>({
    channel,
    onPayload,
  });

  const loadFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        setItems([]);
        setMeta(emptyNotificationsMeta(nextPerPage));
        setUserId(null);
        return;
      }
      setUserId(me.id);
      const t = resolveTenant() || me.tenant_id;
      if (!t) return;
      setTenant(t);
      const res = await api<NotificationsResponse>(
        `/api/v1/org/notifications?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: t },
      );
      setItems(res.data ?? []);
      setMeta(res.meta ?? emptyNotificationsMeta(nextPerPage));
      setUnreadCount(res.meta?.unread_count ?? 0);
      setPage(res.meta?.current_page ?? nextPage);
      setPerPage((res.meta?.per_page as PageSize) || nextPerPage);
    },
    [],
  );

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveItems !== null) {
      applySlice(
        liveItems,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
        unreadCountRef.current,
      );
      setLoading(false);
      return;
    }
    void loadFromApi(page, perPage, filters)
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [
    liveItems,
    page,
    perPage,
    filters,
    filtersKey,
    applySlice,
    loadFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function markAllRead() {
    if (meta.unread_count === 0) return;
    setMarking(true);
    try {
      await ensureCsrf();
      const t = tenant || resolveTenant();
      await api<{ data: { unread_count: number } }>(
        "/api/v1/org/notifications/read",
        {
          method: "POST",
          tenant: t,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        },
      );
      toastSuccess("All notifications marked as read.");
      if (liveItems === null) {
        await loadFromApi(page, perPage, filters);
      }
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
        const t = tenant || resolveTenant();
        await api<{ data: { unread_count: number } }>(
          "/api/v1/org/notifications/read",
          {
            method: "POST",
            tenant: t,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [item.id] }),
          },
        );
      } catch {
        /* still navigate */
      }
    }
    router.push(notificationHref(item));
  }

  const columns: Array<DataTableColumn<UserNotificationItem>> = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      sticky: true,
      cell: (item) => {
        const Icon = notificationTypeIcon(item.type);
        return (
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className={cn("font-medium", !item.read_at && "text-[var(--primary)]")}>
              {item.title}
            </span>
          </span>
        );
      },
    },
    {
      id: "body",
      header: "Message",
      accessorKey: "body",
      className: "max-w-md whitespace-pre-wrap",
      cell: (item) => item.body || "—",
    },
    {
      id: "unread",
      header: "Read",
      filter: "select",
      filterOptions: [
        { label: "Unread", value: "1" },
        { label: "Read", value: "0" },
      ],
      filterValue: (item) => (item.read_at ? "0" : "1"),
      enableSorting: false,
      cell: (item) => (item.read_at ? "Read" : "Unread"),
    },
    {
      id: "created_at",
      header: "When",
      filter: "none",
      cell: (item) => (item.created_at ? new Date(item.created_at).toLocaleString() : "—"),
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (item) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            void openItem(item);
          }}
        >
          Open
        </Button>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description={
          statusLabel
            ? `Assignments, ticket updates, and organization announcements. · ${statusLabel}`
            : "Assignments, ticket updates, and organization announcements. · Live"
        }
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

      <DataTable
        className="mt-8"
        mode="server"
        caption="Notifications"
        columns={columns}
        rows={items}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        onRowClick={(item) => void openItem(item)}
        emptyTitle="You are all caught up"
        emptyDescription="New assignments and announcements will show up here."
        pagination={{
          page,
          perPage,
          total: meta.total,
          onPageChange: setPage,
          onPerPageChange: (size) => {
            setPerPage(size);
            setPage(1);
          },
        }}
      />
    </div>
  );
}
