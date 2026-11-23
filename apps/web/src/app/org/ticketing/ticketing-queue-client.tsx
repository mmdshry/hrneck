"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
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
import type { SdDesk, SdTicket } from "./ticketing-types";

type TicketsPayload = {
  data: SdTicket[];
};

type TicketPreferences = {
  ticket_scope: string;
  email_send_delay_minutes: number;
  default_desk_id: number | null;
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
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [createDeskId, setCreateDeskId] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmMergeOpen, setConfirmMergeOpen] = useState(false);
  const [groupStageId, setGroupStageId] = useState("");
  const [groupPriorityId, setGroupPriorityId] = useState("");
  const [groupAssigneePool, setGroupAssigneePool] = useState("");
  const [prefs, setPrefs] = useState<TicketPreferences>({
    ticket_scope: "all",
    email_send_delay_minutes: 0,
    default_desk_id: null,
  });
  const [groupDesk, setGroupDesk] = useState<SdDesk | null>(null);
  const canAdmin = Boolean(session && hasPermission(session, "org.ticketing.admin"));

  const selectedDeskId = useMemo(() => {
    const first = tickets.find((t) => selected.includes(t.id));
    return first?.desk_id ?? null;
  }, [tickets, selected]);

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
    const preferred =
      activeDesks.find((d) => d.type === "incident")?.id ?? activeDesks[0]?.id;
    if (preferred) {
      setCreateDeskId((prev) => prev || String(preferred));
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: TicketPreferences }>("/api/v1/org/ticketing/preferences", {
      tenant: resolveTenant(),
    });
    setPrefs({
      ticket_scope: res.data.ticket_scope ?? "all",
      email_send_delay_minutes: res.data.email_send_delay_minutes ?? 0,
      default_desk_id: res.data.default_desk_id ?? null,
    });
    if (res.data.default_desk_id) {
      setCreateDeskId(String(res.data.default_desk_id));
    }
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

  const { status, error: liveError } = useLiveTopic<TicketsPayload>({
    channel,
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

  useEffect(() => {
    if (!selectedDeskId) {
      setGroupDesk(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureCsrf();
        const detail = await api<{ data: SdDesk }>(
          `/api/v1/org/ticketing/desks/${selectedDeskId}`,
          { tenant: resolveTenant() },
        );
        if (!cancelled) setGroupDesk(detail.data);
      } catch {
        if (!cancelled) setGroupDesk(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDeskId]);

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

  const statusLabel = liveStatusLabel(status);

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

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const desk = Number(createDeskId);
    if (!desk) {
      toastInfo(t("selectDeskBeforeCreate"));
      return;
    }
    try {
      await ensureCsrf();
      const created = await api<{ data: SdTicket }>("/api/v1/org/ticketing/tickets", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: desk,
          summary,
          description: description || null,
        }),
      });
      setSummary("");
      setDescription("");
      toastSuccess(t("createdTicket", { number: created.data.number }));
      window.location.assign(`/org/ticketing/tickets/${created.data.id}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    }
  }

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
      toastSuccess(t("bulkComplete", { action }));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("bulkFailed"));
      throw err;
    }
  }

  async function applyGroupUpdate(event: FormEvent) {
    event.preventDefault();
    if (selected.length === 0) {
      toastInfo(t("selectTicketsFirst"));
      return;
    }
    const fields: Record<string, string | number> = {};
    if (groupStageId) fields.stage_id = Number(groupStageId);
    if (groupPriorityId) fields.priority_id = Number(groupPriorityId);
    if (groupAssigneePool.trim()) fields.assignee_pool = groupAssigneePool.trim();
    if (Object.keys(fields).length === 0) {
      toastInfo(t("chooseFieldToUpdate"));
      return;
    }
    try {
      await bulk("group_update", { fields });
      setGroupStageId("");
      setGroupPriorityId("");
      setGroupAssigneePool("");
    } catch {
      /* toast already shown */
    }
  }

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      const res = await api<{ data: TicketPreferences }>("/api/v1/org/ticketing/preferences", {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_scope: prefs.ticket_scope,
          email_send_delay_minutes: Number(prefs.email_send_delay_minutes) || 0,
          default_desk_id: prefs.default_desk_id,
        }),
      });
      setPrefs({
        ticket_scope: res.data.ticket_scope ?? "all",
        email_send_delay_minutes: res.data.email_send_delay_minutes ?? 0,
        default_desk_id: res.data.default_desk_id ?? null,
      });
      if (res.data.default_desk_id) {
        setCreateDeskId(String(res.data.default_desk_id));
      }
      toastSuccess(t("preferencesSaved"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("preferencesFailed"));
    }
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

  async function importTickets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdmin) return;
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("import_file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { tickets?: unknown } | unknown;
      const payload =
        parsed && typeof parsed === "object" && "tickets" in (parsed as object)
          ? (parsed as { tickets: unknown })
          : { tickets: parsed };
      await ensureCsrf();
      await api("/api/v1/org/ticketing/import", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      form.reset();
      toastSuccess(t("importComplete"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("importFailed"));
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
            <LinkButton href="/org/ticketing/search" variant="outline">
              {t("searchAll")}
            </LinkButton>
            <LinkButton href="/org/ticketing/kb" variant="outline">
              {t("knowledgeBase")}
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
      <Panel title={t("newTicket")}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <div className="space-y-1">
            <Label htmlFor="desk">{tCommon("desk")}</Label>
            <Select id="desk" value={createDeskId} onChange={(e) => setCreateDeskId(e.target.value)} required>
              {desks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="summary">{tCommon("summary")}</Label>
            <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} required />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="description">{tCommon("descriptionLabel")}</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Button type="submit">{t("createTicket")}</Button>
          </div>
        </form>
      </Panel>

      <Panel title={t("preferences")}>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={savePreferences}>
          <div className="space-y-1">
            <Label htmlFor="pref-scope">{t("ticketScope")}</Label>
            <Select
              id="pref-scope"
              value={prefs.ticket_scope}
              onChange={(e) => setPrefs({ ...prefs, ticket_scope: e.target.value })}
            >
              <option value="all">{tCommon("all")}</option>
              <option value="assigned">{tCommon("assigned")}</option>
              <option value="own">{tCommon("own")}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pref-delay">{t("emailSendDelay")}</Label>
            <Input
              id="pref-delay"
              type="number"
              min={0}
              max={1440}
              value={prefs.email_send_delay_minutes}
              onChange={(e) =>
                setPrefs({ ...prefs, email_send_delay_minutes: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pref-desk">{t("defaultDesk")}</Label>
            <Select
              id="pref-desk"
              value={prefs.default_desk_id != null ? String(prefs.default_desk_id) : ""}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  default_desk_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{tCommon("none")}</option>
              {desks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Button type="submit">{t("savePreferences")}</Button>
          </div>
        </form>
      </Panel>

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

      <Panel title={t("groupUpdate")}>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={applyGroupUpdate}>
          <div className="space-y-1">
            <Label htmlFor="group-stage">{tCommon("stage")}</Label>
            <Select
              id="group-stage"
              value={groupStageId}
              onChange={(e) => setGroupStageId(e.target.value)}
            >
              <option value="">{t("noChange")}</option>
              {(groupDesk?.stages ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="group-priority">{tCommon("priority")}</Label>
            <Select
              id="group-priority"
              value={groupPriorityId}
              onChange={(e) => setGroupPriorityId(e.target.value)}
            >
              <option value="">{t("noChange")}</option>
              {(groupDesk?.priorities ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="group-pool">{t("assigneePool")}</Label>
            <Input
              id="group-pool"
              value={groupAssigneePool}
              onChange={(e) => setGroupAssigneePool(e.target.value)}
              placeholder={t("assigneePoolPlaceholder")}
            />
          </div>
          <div>
            <Button type="submit">{t("applyToSelected")}</Button>
          </div>
        </form>
        {!groupDesk ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {t("groupUpdateHint")}
          </p>
        ) : null}
      </Panel>

      {canAdmin ? (
        <Panel title={t("importTickets")}>
          <form className="flex flex-wrap items-end gap-2" onSubmit={importTickets}>
            <div className="space-y-1">
              <Label htmlFor="import-file">{t("jsonExportFile")}</Label>
              <Input id="import-file" name="import_file" type="file" accept="application/json,.json" required />
            </div>
            <Button type="submit">{tCommon("import")}</Button>
          </form>
        </Panel>
      ) : null}

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("deleteTickets")}
        description={t("deleteTicketsConfirm", { count: selected.length })}
        confirmLabel={tCommon("delete")}
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
        onConfirm={async () => {
          await bulk("merge", { primary_id: selected[0] });
        }}
      />
    </div>
  );
}
