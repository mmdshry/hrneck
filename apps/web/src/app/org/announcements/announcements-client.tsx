"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "next-intl";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { formatDateTime } from "@/lib/format-datetime";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
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
import { matchesCells } from "@/lib/table-filter";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import type { Announcement } from "./announcement-types";
import { PublishAnnouncementDialog } from "./publish-announcement-dialog";

type AnnouncementsPayload = {
  data: Announcement[];
};

export function AnnouncementsClient() {
  const t = useTranslations("org.announcements");
  const tCommon = useTranslations("common");
  const orgTimeZone = useOrgTimezone();
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "announcements") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Announcement[]>([]);
  const [liveRows, setLiveRows] = useState<Announcement[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [loaded, setLoaded] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
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

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  async function afterMutation() {
    if (liveRows === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  async function onPublished(created: Announcement | undefined) {
    setPublishOpen(false);
    setPage(1);
    if (created && liveRows !== null) {
      setLiveRows([created, ...liveRows.filter((row) => row.id !== created.id)]);
    } else {
      await refreshFromApi(1, perPage, filters);
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
      cell: (row) => (row.published_at ? formatDateTime(row.published_at, orgTimeZone) : "—"),
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
          {tCommon("delete")}
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
        <EmptyState title={t("noPermission")} />
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
        actions={
          <Button type="button" onClick={() => setPublishOpen(true)}>
            {t("newAnnouncement")}
          </Button>
        }
      />

      <section className="mt-8" aria-label={t("recentCaption")}>
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

      {publishOpen ? (
        <PublishAnnouncementDialog
          onClose={() => setPublishOpen(false)}
          onPublished={onPublished}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("deleteAnnouncement")}
        description={t("deleteAnnouncementDescription", { title: pendingDelete?.title ?? "" })}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        workingLabel={tCommon("working")}
        errorFallback={tCommon("deleteFailed")}
        closeLabel={tCommon("close")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteAnnouncement(pendingDelete);
        }}
      />
    </div>
  );
}
