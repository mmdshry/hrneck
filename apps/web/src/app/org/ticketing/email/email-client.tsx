"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { SdDesk } from "../ticketing-types";
import type { Reader, ReaderMode } from "./email-reader-logic";
import { EmailReaderWizard } from "./email-reader-wizard";

type ReadersPayload = {
  data: Reader[];
};

function readerCells(reader: Reader): Record<string, string> {
  return {
    name: reader.name,
    username: reader.username,
    host: reader.host,
    active: reader.is_active ? "1" : "0",
  };
}

export function EmailClient() {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "email-readers") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [liveReaders, setLiveReaders] = useState<Reader[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  /** Open reader wizard: `reader` is the reader being edited, or null for the add flow. */
  const [editor, setEditor] = useState<{ reader: Reader | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Reader | null>(null);
  const [pendingIngest, setPendingIngest] = useState<Reader | null>(null);
  const [loading, setLoading] = useState(true);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const applyLiveSlice = useCallback(
    (
      items: Reader[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((reader) =>
        matchesCells(q, columnFilters, readerCells(reader)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setReaders(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: ReadersPayload) => {
    setLiveReaders(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const loadDesksOnce = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;
    const t = resolveTenant();
    const deskList = await api(`/api/v1/org/ticketing/desks?${paginationQuery(1, 100)}`, {
      tenant: t,
    });
    const deskParsed = parsePaginatedResponse<SdDesk>(deskList, 100);
    const deskItems = deskParsed.data.filter((d) => d.type !== "kb");
    setDesks(deskItems);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      setSession(me);
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const list = await api(
        `/api/v1/org/ticketing/email-readers?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: t },
      );
      const parsed = parsePaginatedResponse<Reader>(list, nextPerPage);
      setReaders(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<ReadersPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    if (session && !hasPermission(session, "org.ticketing.admin")) {
      toastError(t("needAdminPermission"));
    }
  }, [session, t]);

  useEffect(() => {
    void loadDesksOnce().catch(() => {
      /* readers bootstrap may still succeed */
    });
  }, [loadDesksOnce]);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveReaders !== null) {
      applyLiveSlice(
        liveReaders,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch((err: unknown) =>
        toastError(err instanceof Error ? err.message : tCommon("loadFailed")),
      )
      .finally(() => setLoading(false));
  }, [
    liveReaders,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
    tCommon,
  ]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  async function afterMutation() {
    if (liveReaders === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  async function handleSaved(mode: ReaderMode) {
    if (mode === "create") {
      setPage(1);
    }
    await afterMutation();
  }

  async function deleteReader(reader: Reader) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/email-readers/${reader.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    toastSuccess(t("readerDeleted"));
    await afterMutation();
  }

  async function ingestTest(readerId: number) {
    try {
      await ensureCsrf();
      const res = await api<{ data: { number: string } }>(
        `/api/v1/org/ticketing/email-readers/${readerId}/ingest`,
        {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "user@example.com",
            subject: "Printer offline",
            body: "Cannot print from floor 2.",
          }),
        },
      );
      toastSuccess(t("ingestedAs", { number: res.data.number }));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("ingestFailed"));
    }
  }

  const columns: Array<DataTableColumn<Reader>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (reader) => reader.name,
    },
    {
      id: "username",
      header: tCommon("username"),
      accessorKey: "username",
      cell: (reader) => reader.username,
    },
    {
      id: "host",
      header: tCommon("host"),
      accessorKey: "host",
      cell: (reader) => reader.host,
    },
    {
      id: "active",
      header: tCommon("active"),
      filter: "select",
      filterOptions: [
        { label: tCommon("active"), value: "1" },
        { label: tCommon("inactive"), value: "0" },
      ],
      filterValue: (reader) => (reader.is_active ? "1" : "0"),
      enableSorting: false,
      cell: (reader) => (reader.is_active ? tCommon("active") : tCommon("inactive")),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (reader) => (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setEditor({ reader })}
          >
            {tCommon("edit")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setPendingIngest(reader)}
          >
            {t("ingestTestMail")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setPendingDelete(reader)}
          >
            {tCommon("delete")}
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.admin")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("emailReaders")} description={t("emailDescription")} />
        <EmptyState title={t("needAdminPermission")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("emailReaders")}
        description={
          statusLabel
            ? `${t("emailDescription")} · ${statusLabel}`
            : t("emailDescription")
        }
        actions={
          <>
            <LinkButton href="/org/ticketing" variant="outline">
              {t("queue")}
            </LinkButton>
            <Button type="button" onClick={() => setEditor({ reader: null })}>
              {t("addReader")}
            </Button>
          </>
        }
      />
      <Panel title={t("configured")}>
        <DataTable
          mode="server"
          caption={t("emailReadersCaption")}
          columns={columns}
          rows={readers}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noReadersYet")}
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
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("deleteEmailReader")}
        description={t("deleteEmailReaderConfirm", { name: pendingDelete?.name ?? "" })}
        confirmLabel={tCommon("delete")}
        workingLabel={tCommon("working")}
        errorFallback={tCommon("deleteFailed")}
        closeLabel={tCommon("close")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteReader(pendingDelete);
        }}
      />
      <ConfirmDialog
        open={pendingIngest !== null}
        onOpenChange={(open) => {
          if (!open) setPendingIngest(null);
        }}
        title={t("ingestTestMail")}
        description={t("ingestTestMailConfirm", { name: pendingIngest?.name ?? "" })}
        confirmLabel={t("createTicket")}
        workingLabel={tCommon("working")}
        closeLabel={tCommon("close")}
        onConfirm={async () => {
          if (!pendingIngest) return;
          await ingestTest(pendingIngest.id);
        }}
      />
      {editor ? (
        <EmailReaderWizard
          reader={editor.reader}
          desks={desks}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
