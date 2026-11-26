"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { downloadBlob } from "@/lib/download";
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
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import { NewTicketDialog } from "./new-ticket-dialog";
import {
  defaultTicketDeskId,
  normalizeTicketPreferences,
  type TicketPreferences,
} from "./ticket-dialog-logic";
import { TicketGroupDialog } from "./ticket-group-dialog";
import { TicketImportDialog } from "./ticket-import-dialog";
import { TicketPreferencesDialog } from "./ticket-preferences-dialog";
import type { SdDesk, SdTicket } from "./ticketing-types";

type TicketsPayload = {
  data: SdTicket[];
};

function filterTicketsLive(
  items: SdTicket[],
  q: string,
  columnFilters: Record<string, string>,
  showArchived: boolean,
): SdTicket[] {
  const needle = q.trim().toLowerCase();
  return items.filter((t) => {
    const isArchived = Boolean(t.archived_at);
    if (showArchived !== isArchived) return false;
    if (needle) {
      const hay =
        `${t.number} ${t.summary} ${t.desk?.name ?? ""} ${t.stage?.name ?? ""} ${t.priority?.name ?? ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    for (const [key, raw] of Object.entries(columnFilters)) {
      const value = raw.trim().toLowerCase();
      if (!value) continue;
      const cell =
        key === "number"
          ? t.number
          : key === "summary"
            ? t.summary
            : key === "desk"
              ? t.desk?.name
              : key === "stage"
                ? t.stage?.name
                : key === "priority"
                  ? t.priority?.name
                  : key === "sla"
                    ? t.sla_response_breached || t.sla_resolve_breached
                      ? "breach"
                      : "ok"
                    : key === "desk_id"
                      ? String(t.desk_id ?? t.desk?.id ?? "")
                      : "";
      if (!String(cell ?? "")
        .toLowerCase()
        .includes(value)) {
        return false;
      }
    }
    return true;
  });
}

export function TicketingQueueClient() {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "tickets") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [tickets, setTickets] = useState<SdTicket[]>([]);
  const [liveTickets, setLiveTickets] = useState<SdTicket[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const tableQuery = useDataTableQuery();
  const appliedFilters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const appliedFiltersKey = useMemo(
    () => JSON.stringify(appliedFilters),
    [appliedFilters],
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmMergeOpen, setConfirmMergeOpen] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [prefs, setPrefs] = useState<TicketPreferences>({
    ticket_scope: "all",
    email_send_delay_minutes: 0,
    default_desk_id: null,
  });
  const canAdmin = Boolean(session && hasPermission(session, "org.ticketing.admin"));

  const selectedDeskId = useMemo(() => {
    const first = tickets.find((t) => selected.includes(t.id));
    return first?.desk_id ?? null;
  }, [tickets, selected]);

  const newTicketDeskId = defaultTicketDeskId(prefs.default_desk_id, desks);

  const applyLiveSlice = useCallback(
    (
      items: SdTicket[],
      nextPage: number,
      nextPerPage: number,
      nextQ: string,
      nextColumnFilters: Record<string, string>,
      nextArchived: boolean,
    ) => {
      const filtered = filterTicketsLive(items, nextQ, nextColumnFilters, nextArchived);
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setTickets(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: TicketsPayload) => {
    setLiveTickets(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const loadDesksOnce = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;
    const t = resolveTenant();
    const deskList = await api<{ data: SdDesk[] }>("/api/v1/org/ticketing/desks?per_page=100", {
      tenant: t,
    });
    const activeDesks = (deskList.data ?? []).filter((d) => d.type !== "kb");
    setDesks(activeDesks);
  }, []);

  const loadPreferences = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: TicketPreferences }>("/api/v1/org/ticketing/preferences", {
      tenant: resolveTenant(),
    });
    setPrefs(normalizeTicketPreferences(res.data));
  }, []);

  const refreshFromApi = useCallback(
    async (
      nextPage: number,
      nextPerPage: number,
      nextFilters: Record<string, string>,
      nextArchived: boolean,
    ) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      setSession(me);
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const params = paginationQuery(nextPage, nextPerPage, {
        ...nextFilters,
        archived: nextArchived ? 1 : undefined,
      });
      const list = await api(`/api/v1/org/ticketing/tickets?${params}`, { tenant: t });
      const parsed = parsePaginatedResponse<SdTicket>(list, nextPerPage);
      setTickets(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
      setPerPage(parsed.meta.per_page as PageSize);
    },
    [],
  );

  // Org-wide live feed is only for users who can see every ticket; others use REST.
  const canViewAllTickets = Boolean(session && hasPermission(session, "org.ticketing.view_all"));
  const { status, error: liveError } = useLiveTopic<TicketsPayload>({
    channel,
    enabled: canViewAllTickets,
    onPayload,
  });

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    if (session && !hasPermission(session, "org.ticketing.tickets")) {
      toastError(t("needTicketsPermission"));
    }
  }, [session, t]);

  useEffect(() => {
    void loadDesksOnce().catch(() => {
      /* tickets bootstrap may still succeed */
    });
    void loadPreferences().catch(() => {
      /* preferences are optional on first paint */
    });
  }, [loadDesksOnce, loadPreferences]);

  // Live snapshot is active tickets only and ignores ticket_scope prefs — use REST then.
  const useLiveQueue = !showArchived && prefs.ticket_scope === "all";

  useEffect(() => {
    setPage(1);
  }, [appliedFiltersKey, showArchived, prefs.ticket_scope]);

  useEffect(() => {
    if (!useLiveQueue || liveTickets === null) {
      return;
    }
    applyLiveSlice(
      liveTickets,
      page,
      perPage,
      tableQuery.debounced.q,
      tableQuery.debounced.columnFilters,
      showArchived,
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useLiveQueue,
    liveTickets,
    page,
    perPage,
    appliedFiltersKey,
    showArchived,
    applyLiveSlice,
  ]);

  const needsRestBootstrap = useLiveQueue && liveTickets === null;
  const needsRestMode = !useLiveQueue;

  // REST when archived / scoped, or as bootstrap before the live snapshot arrives.
  // Do not depend on liveTickets while in REST mode — socket updates would cancel the fetch.
  useEffect(() => {
    if (!needsRestMode && !needsRestBootstrap) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    void refreshFromApi(page, perPage, appliedFilters, showArchived)
      .catch((err: unknown) => {
        if (!cancelled) {
          toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    needsRestMode,
    needsRestBootstrap,
    page,
    perPage,
    appliedFiltersKey,
    appliedFilters,
    showArchived,
    prefs.ticket_scope,
    refreshFromApi,
  ]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = canViewAllTickets ? liveStatusLabel(status, liveLabels) : null;

  async function afterMutation() {
    if (!useLiveQueue || liveTickets === null) {
      await refreshFromApi(page, perPage, appliedFilters, showArchived);
    }
  }

  const ticketColumns: Array<DataTableColumn<SdTicket>> = useMemo(
    () => [
      {
        id: "select",
        header: tCommon("select"),
        filter: "none",
        enableSorting: false,
        enableGlobalFilter: false,
        sticky: true,
        cell: (ticket) => (
          <input
            type="checkbox"
            aria-label={t("selectTicketAria", { number: ticket.number })}
            checked={selected.includes(ticket.id)}
            onChange={(e) => {
              setSelected((prev) =>
                e.target.checked ? [...prev, ticket.id] : prev.filter((id) => id !== ticket.id),
              );
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: "number",
        header: tCommon("number"),
        accessorKey: "number",
        cell: (ticket) => (
          <a
            className="font-medium underline-offset-2 hover:underline"
            href={`/org/ticketing/tickets/${ticket.id}`}
          >
            {ticket.number}
          </a>
        ),
      },
      {
        id: "summary",
        header: tCommon("summary"),
        accessorKey: "summary",
        className: "max-w-xs truncate",
        cell: (ticket) => ticket.summary,
      },
      {
        id: "desk",
        header: tCommon("desk"),
        filterValue: (ticket) => ticket.desk?.name,
        cell: (ticket) => ticket.desk?.name,
      },
      {
        id: "stage",
        header: tCommon("stage"),
        filterValue: (ticket) => ticket.stage?.name,
        cell: (ticket) => ticket.stage?.name,
      },
      {
        id: "priority",
        header: tCommon("priority"),
        filterValue: (ticket) => ticket.priority?.name,
        cell: (ticket) => ticket.priority?.name,
      },
      {
        id: "sla",
        header: t("sla"),
        filter: "select",
        filterOptions: [
          { label: tCommon("ok"), value: "ok" },
          { label: t("breach"), value: "breach" },
        ],
        filterValue: (ticket) =>
          ticket.sla_response_breached || ticket.sla_resolve_breached ? "breach" : "ok",
        cell: (ticket) =>
          ticket.sla_response_breached || ticket.sla_resolve_breached
            ? t("breach")
            : tCommon("ok"),
      },
    ],
    [selected, t, tCommon],
  );

  async function bulk(action: string, extra: Record<string, unknown> = {}) {
    if (selected.length === 0) return;
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/tickets/bulk", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: selected, ...extra }),
      });
      setSelected([]);
      toastSuccess(t("bulkActionComplete", { action }));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("bulkFailed"));
      throw err;
    }
  }

  function openGroupUpdate() {
    if (selected.length === 0) {
      toastInfo(t("selectTicketsFirst"));
      return;
    }
    setGroupOpen(true);
  }

  async function exportSelected() {
    if (!canAdmin) return;
    if (selected.length === 0) {
      toastInfo(t("selectTicketsToExport"));
      return;
    }
    try {
      await ensureCsrf();
      const res = await api<{ data: unknown }>("/api/v1/org/ticketing/export", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      downloadBlob(
        new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" }),
        "ticketing-export.json",
      );
      toastSuccess(t("exportDownloaded"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("exportFailed"));
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.tickets")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState title={t("needTicketsPermission")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={
          statusLabel ? `${t("description")} · ${statusLabel}` : t("description")
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setNewTicketOpen(true)}>
              {t("newTicket")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPreferencesOpen(true)}>
              {t("preferences")}
            </Button>
            <Button type="button" variant="outline" onClick={openGroupUpdate}>
              {t("groupUpdate")}
            </Button>
            {canAdmin ? (
              <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                {t("importTickets")}
              </Button>
            ) : null}
            <LinkButton href="/org/ticketing/search" variant="outline">
              {t("searchAll")}
            </LinkButton>
            <LinkButton href="/org/ticketing/desks" variant="outline">
              {t("desks")}
            </LinkButton>
            <LinkButton href="/org/ticketing/email" variant="outline">
              {t("email")}
            </LinkButton>
            <LinkButton href="/org/ticketing/reports" variant="outline">
              {t("reports")}
            </LinkButton>
            <LinkButton href="/portal/tickets" variant="outline">
              {t("portal")}
            </LinkButton>
          </div>
        }
      />
      <Panel
        title={showArchived ? t("archivedQueue") : t("queue")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={showArchived ? "default" : "outline"}
              onClick={() => {
                setShowArchived((prev) => !prev);
                setSelected([]);
              }}
            >
              {showArchived ? t("showingArchived") : t("showArchived")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("archive")}>
              {tCommon("archive")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("unarchive")}>
              {tCommon("unarchive")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("read")}>
              {tCommon("markRead")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("unread")}>
              {tCommon("markUnread")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("stop_notification")}>
              {tCommon("stopNotification")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("link")}>
              {tCommon("link")}
            </Button>
            <Button type="button" variant="outline" onClick={() => void bulk("unlock")}>
              {tCommon("unlock")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (selected.length < 2) {
                  toastInfo(t("selectAtLeastTwoToMerge"));
                  return;
                }
                setConfirmMergeOpen(true);
              }}
            >
              {tCommon("merge")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (selected.length === 0) {
                  toastInfo(t("selectTicketsToDelete"));
                  return;
                }
                setConfirmDeleteOpen(true);
              }}
            >
              {tCommon("delete")}
            </Button>
            {canAdmin ? (
              <Button type="button" variant="outline" onClick={() => void exportSelected()}>
                {tCommon("exportJson")}
              </Button>
            ) : null}
          </div>
        }
      >
        <DataTable
          mode="server"
          caption={t("serviceDeskQueueCaption")}
          columns={ticketColumns}
          rows={tickets}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noTicketsYet")}
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
      </Panel>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("deleteTickets")}
        description={t("deleteTicketsConfirm", { count: selected.length })}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        workingLabel={tCommon("working")}
        variant="destructive"
        onConfirm={async () => {
          await bulk("delete");
        }}
      />

      <ConfirmDialog
        open={confirmMergeOpen}
        onOpenChange={setConfirmMergeOpen}
        title={t("mergeTickets")}
        description={t("mergeTicketsConfirm", { count: selected.length, primary: selected[0] ?? tCommon("emDash") })}
        confirmLabel={tCommon("merge")}
        cancelLabel={tCommon("cancel")}
        workingLabel={tCommon("working")}
        onConfirm={async () => {
          await bulk("merge", { primary_id: selected[0] });
        }}
      />

      <NewTicketDialog
        open={newTicketOpen}
        onOpenChange={setNewTicketOpen}
        desks={desks}
        defaultDeskId={newTicketDeskId}
      />

      <TicketPreferencesDialog
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        prefs={prefs}
        desks={desks}
        onSaved={setPrefs}
      />

      <TicketGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        selectedCount={selected.length}
        deskId={selectedDeskId}
        onApply={(fields) => bulk("group_update", { fields })}
      />

      {canAdmin ? (
        <TicketImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={afterMutation}
        />
      ) : null}
    </div>
  );
}
