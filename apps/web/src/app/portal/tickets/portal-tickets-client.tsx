"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import { portalLiveChannel } from "@/lib/live-topics";
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
import { toastError } from "@/lib/toast";
import { NewRequestWizard } from "./new-request-wizard";
import type { Desk } from "./portal-ticket-types";

type Ticket = {
  id: number;
  number: string;
  summary: string;
  stage?: { name: string } | null;
  status?: { name: string } | null;
};

type PortalPayload = {
  tickets: Ticket[];
  desks: Desk[];
  kb?: unknown[];
};

function ticketCells(ticket: Ticket): Record<string, string> {
  return {
    number: ticket.number,
    summary: ticket.summary,
    stage: ticket.stage?.name ?? "",
    status: ticket.status?.name ?? "",
  };
}

function filterTickets(
  items: Ticket[],
  q: string,
  columnFilters: Record<string, string>,
): Ticket[] {
  const needle = q.trim().toLowerCase();
  return items.filter((ticket) => {
    if (needle) {
      const hay = `${ticket.number} ${ticket.summary}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    const cells = ticketCells(ticket);
    for (const [key, raw] of Object.entries(columnFilters)) {
      const value = raw.trim().toLowerCase();
      if (!value) continue;
      if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
    }
    return true;
  });
}

export function PortalTicketsClient() {
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [liveTickets, setLiveTickets] = useState<Ticket[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [wizardOpen, setWizardOpen] = useState(false);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const channel =
    tenant && session?.id != null ? portalLiveChannel(tenant, session.id) : null;

  const applyLiveSlice = useCallback(
    (
      items: Ticket[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = filterTickets(items, q, columnFilters);
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setTickets(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: PortalPayload) => {
    setLiveTickets(Array.isArray(payload.tickets) ? payload.tickets : []);
    if (Array.isArray(payload.desks)) {
      setDesks(payload.desks);
    }
  }, []);

  const refreshFromApi = useCallback(async (
    nextPage: number,
    nextPerPage: number,
    nextFilters: Record<string, string>,
  ) => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    setAuthChecked(true);
    if (!me) {
      return;
    }
    const tenantId = resolveTenant();
    const [deskList, list] = await Promise.all([
      api<{ data: Desk[] }>("/api/v1/org/portal/ticketing/desks", { tenant: tenantId }),
      api(`/api/v1/org/portal/ticketing/tickets?${paginationQuery(nextPage, nextPerPage, nextFilters)}`, {
        tenant: tenantId,
      }),
    ]);
    const parsed = parsePaginatedResponse<Ticket>(list, nextPerPage);
    setDesks(deskList.data ?? []);
    setTickets(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
  }, []);

  const { status } = useLiveTopic<PortalPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser()
      .then((me) => {
        setSession(me);
        setAuthChecked(true);
      })
      .catch(() => {
        setSession(null);
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!authChecked || !session) return;
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveTickets !== null) {
      applyLiveSlice(
        liveTickets,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      return;
    }
    void refreshFromApi(page, perPage, filters).catch((err: unknown) =>
      toastError(err instanceof Error ? err.message : t("loadFailed")),
    );
  }, [
    authChecked,
    session,
    liveTickets,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
    t,
  ]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);
  const dash = tCommon("emDash");

  const canPortal = session ? hasPermission(session, "org.ticketing.portal") : false;

  const ticketColumns: Array<DataTableColumn<Ticket>> = [
    {
      id: "number",
      header: tCommon("number"),
      accessorKey: "number",
      sticky: true,
      cell: (ticket) => (
        <a className="underline-offset-2 hover:underline" href={`/portal/tickets/${ticket.id}`}>
          {ticket.number}
        </a>
      ),
    },
    {
      id: "summary",
      header: t("summary"),
      accessorKey: "summary",
      cell: (ticket) => ticket.summary,
    },
    {
      id: "stage",
      header: tCommon("stage"),
      filterValue: (ticket) => ticket.stage?.name ?? "",
      cell: (ticket) => ticket.stage?.name || dash,
    },
    {
      id: "status",
      header: tCommon("status"),
      filterValue: (ticket) => ticket.status?.name ?? "",
      cell: (ticket) => ticket.status?.name || dash,
    },
  ];

  if (!authChecked) {
    return <PageSkeleton />;
  }

  if (authChecked && !session) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("myTickets")} description={t("endUserPortal")} />
        <EmptyState
          title={t("signInToView")}
          action={
            <LinkButton href="/login?next=/portal/tickets" variant="link" size="sm" className="px-1">
              {t("signIn")}
            </LinkButton>
          }
        />
      </div>
    );
  }

  if (session && !canPortal) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("myTickets")} description={t("endUserPortal")} />
        <EmptyState title={t("needPortalPermission")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("myTickets")}
        description={
          statusLabel
            ? `${t("submitAndTrack")} · ${statusLabel}`
            : t("submitAndTrack")
        }
        actions={
          canPortal ? (
            <Button type="button" onClick={() => setWizardOpen(true)}>
              {t("newRequest")}
            </Button>
          ) : null
        }
      />
      <Panel title={t("openTickets")}>
        <DataTable
          mode="server"
          caption={t("openTickets")}
          columns={ticketColumns}
          rows={tickets}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noTickets")}
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
      {wizardOpen ? (
        <NewRequestWizard desks={desks} onClose={() => setWizardOpen(false)} />
      ) : null}
    </div>
  );
}
