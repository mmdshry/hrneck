"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { orgLiveChannel } from "@/lib/live-topics";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";

type Announcement = {
  id: number;
  title: string;
  body: string;
  published_at?: string | null;
};

type AnnouncementsPayload = {
  data: Announcement[];
};

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

export function AnnouncementsClient() {
  const t = useTranslations("org.announcements");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "announcements") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Announcement[]>([]);
  const [liveRows, setLiveRows] = useState<Announcement[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const applyLiveSlice = useCallback(
    (
      items: Announcement[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((row) =>
        matchesCells(q, columnFilters, {
          title: row.title,
          body: row.body,
        }),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setRows(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: AnnouncementsPayload) => {
    setLiveRows(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      const tenantSlug = resolveTenant();
      const res = await api(
        `/api/v1/org/announcements?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: tenantSlug },
      );
      const parsed = parsePaginatedResponse<Announcement>(res, nextPerPage);
      setRows(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<AnnouncementsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        setSession(me);
      } catch {
        setSession(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveRows !== null) {
      applyLiveSlice(
        liveRows,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoaded(true);
      return;
    }
    void (async () => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        setSession(me);
        if (me) {
          await refreshFromApi(page, perPage, filters);
        }
      } catch (err) {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      } finally {
        setLoaded(true);
      }
    })();
  }, [
    liveRows,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function afterMutation() {
    if (liveRows === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  async function onPublish(event: FormEvent) {
    event.preventDefault();
    setPublishing(true);
    try {
      await ensureCsrf();
      const tenantSlug = resolveTenant();
      const res = (await api("/api/v1/org/announcements", {
        method: "POST",
        tenant: tenantSlug,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      })) as { data?: Announcement };
      const created = res.data;
      setTitle("");
      setBody("");
      setPage(1);
      if (created && liveRows !== null) {
        setLiveRows([created, ...liveRows.filter((row) => row.id !== created.id)]);
      } else {
        await refreshFromApi(1, perPage, filters);
      }
      toastSuccess(t("announcementPublished"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("publishFailed"));
    } finally {
      setPublishing(false);
    }
  }

  async function deleteAnnouncement(row: Announcement) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/announcements/${row.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      await afterMutation();
      toastSuccess(t("announcementDeleted"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
      throw err;
    }
  }

  const columns: Array<DataTableColumn<Announcement>> = [
    {
      id: "title",
      header: tCommon("titleLabel"),
      accessorKey: "title",
      sticky: true,
      cell: (row) => row.title,
    },
    {
      id: "body",
      header: tCommon("message"),
      accessorKey: "body",
      className: "max-w-md whitespace-pre-wrap",
      cell: (row) => row.body,
    },
    {
      id: "published_at",
      header: tCommon("published"),
      filter: "none",
      cell: (row) => (row.published_at ? new Date(row.published_at).toLocaleString() : "—"),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => setPendingDelete(row)}
        >
          Delete
        </Button>
      ),
    },
  ];

  if (!loaded) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.announcements.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
        />
        <EmptyState title={"You need org.announcements.manage to publish announcements."} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={
          statusLabel ? `${t("description")} · ${statusLabel}` : t("description")
        }
      />
      

      <form onSubmit={onPublish} className="mt-8 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="announcement-title">Title</Label>
          <Input
            id="announcement-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={190}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="announcement-body">{tCommon("message")}</Label>
          <textarea
            id="announcement-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={5000}
            rows={5}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>
        <Button type="submit" disabled={publishing}>
          {publishing ? t("publishing") : t("publish")}
        </Button>
      </form>

      <section className="mt-10" aria-label={t("recentCaption")}>
        <h2 className="text-lg font-medium">{t("recentCaption")}</h2>
        <DataTable
          className="mt-4"
          mode="server"
          caption={t("recentCaption")}
          columns={columns}
          rows={rows}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noAnnouncementsYet")}
          emptyDescription={t("noAnnouncementsHint")}
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
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("deleteAnnouncement")}
        description={`Delete announcement “${pendingDelete?.title}”?`}
        confirmLabel={tCommon("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteAnnouncement(pendingDelete);
        }}
      />
    </div>
  );
}
