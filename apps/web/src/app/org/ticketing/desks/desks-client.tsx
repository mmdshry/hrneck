"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DeskDetailPanel } from "./desk-detail-panel";
import { DeskDialogs } from "./desk-dialogs";
import { DeskTemplatesPanel } from "./desk-templates-panel";
import type { DeskDialog, TemplateMessage, TemplateNote } from "./desk-types";
import { DeskWizard } from "./desk-wizard";

type DesksPayload = {
  data: SdDesk[];
};

function deskCells(desk: SdDesk): Record<string, string> {
  return {
    name: desk.name,
    slug: desk.slug,
    type: desk.type,
    active: desk.is_active ? "1" : "0",
  };
}

export function DesksClient() {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "desks") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [liveDesks, setLiveDesks] = useState<SdDesk[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<SdDesk | null>(null);
  const [loading, setLoading] = useState(true);
  const [deskWizard, setDeskWizard] = useState<{ desk: SdDesk | null } | null>(null);
  const [dialog, setDialog] = useState<DeskDialog | null>(null);
  const [templates, setTemplates] = useState<{ messages: TemplateMessage[]; notes: TemplateNote[] }>(
    { messages: [], notes: [] },
  );
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState<TemplateMessage | null>(null);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<TemplateNote | null>(null);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);
  const canAdmin = Boolean(session && hasPermission(session, "org.ticketing.admin"));

  const applyLiveSlice = useCallback(
    (
      items: SdDesk[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((desk) => matchesCells(q, columnFilters, deskCells(desk)));
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setDesks(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: DesksPayload) => {
    setLiveDesks(Array.isArray(payload.data) ? payload.data : []);
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
        `/api/v1/org/ticketing/desks?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: t },
      );
      const parsed = parsePaginatedResponse<SdDesk>(list, nextPerPage);
      setDesks(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<DesksPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    void fetchSessionUser()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (
      session &&
      !hasPermission(session, "org.ticketing.admin") &&
      !hasPermission(session, "org.ticketing.tickets")
    ) {
      toastError(t("insufficientPermissions"));
    }
  }, [session, t]);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveDesks !== null) {
      applyLiveSlice(
        liveDesks,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch((err: unknown) => toastError(err instanceof Error ? err.message : tCommon("loadFailed")))
      .finally(() => setLoading(false));
  }, [
    liveDesks,
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

  async function openDesk(id: number, allowTemplates = canAdmin) {
    await ensureCsrf();
    const detail = await api<{ data: SdDesk }>(`/api/v1/org/ticketing/desks/${id}`, {
      tenant: resolveTenant(),
    });
    setSelected(detail.data);
    if (allowTemplates) {
      try {
        await loadTemplates(id);
      } catch {
        setTemplates({ messages: [], notes: [] });
      }
    } else {
      setTemplates({ messages: [], notes: [] });
    }
  }

  async function loadTemplates(deskId: number) {
    const res = await api<{ data: { messages: TemplateMessage[]; notes: TemplateNote[] } }>(
      `/api/v1/org/ticketing/templates?desk_id=${deskId}`,
      { tenant: resolveTenant() },
    );
    setTemplates({
      messages: res.data.messages ?? [],
      notes: res.data.notes ?? [],
    });
  }

  async function afterDeskSaved(saved: SdDesk, created: boolean) {
    if (created) {
      setLiveDesks(null);
      await refreshFromApi(1, perPage, filters);
      await openDesk(saved.id, true);
      return;
    }
    await openDesk(saved.id);
    setLiveDesks(null);
    await refreshFromApi(page, perPage, filters);
  }

  async function deleteMessageTemplate(template: TemplateMessage) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/templates/messages/${template.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    toastSuccess(t("messageTemplateDeleted"));
    if (selected) await loadTemplates(selected.id);
  }

  async function deleteNoteTemplate(template: TemplateNote) {
    await ensureCsrf();
    await api(`/api/v1/org/ticketing/templates/notes/${template.id}`, {
      method: "DELETE",
      tenant: resolveTenant(),
    });
    toastSuccess(t("noteTemplateDeleted"));
    if (selected) await loadTemplates(selected.id);
  }

  const columns: Array<DataTableColumn<SdDesk>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (desk) => (
        <span className={selected?.id === desk.id ? "font-medium" : undefined}>{desk.name}</span>
      ),
    },
    {
      id: "type",
      header: tCommon("type"),
      accessorKey: "type",
      cell: (desk) => desk.type,
    },
    {
      id: "slug",
      header: tCommon("slug"),
      accessorKey: "slug",
      cell: (desk) => desk.slug,
    },
    {
      id: "active",
      header: tCommon("active"),
      filter: "select",
      filterOptions: [
        { label: tCommon("active"), value: "1" },
        { label: tCommon("inactive"), value: "0" },
      ],
      filterValue: (desk) => (desk.is_active ? "1" : "0"),
      enableSorting: false,
      cell: (desk) => (desk.is_active ? tCommon("active") : tCommon("inactive")),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.admin") && !hasPermission(session, "org.ticketing.tickets")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("desks")} description={t("desksDescription")} />
        <EmptyState title={t("insufficientPermissions")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("desks")}
        description={
          statusLabel
            ? `${t("desksDescription")} · ${statusLabel}`
            : t("desksDescription")
        }
        actions={<LinkButton href="/org/ticketing" variant="outline">{t("queue")}</LinkButton>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t("allDesks")}
          actions={
            canAdmin ? (
              <Button type="button" onClick={() => setDeskWizard({ desk: null })}>
                {t("createDesk")}
              </Button>
            ) : undefined
          }
        >
          <DataTable
            mode="server"
            caption={t("desksCaption")}
            columns={columns}
            rows={desks}
            filterState={tableQuery.state}
            onFilterStateChange={tableQuery.setState}
            getRowId={(row) => row.id}
            onRowClick={(desk) => void openDesk(desk.id)}
            emptyTitle={t("noDesksYet")}
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
        {selected ? (
          <DeskDetailPanel
            desk={selected}
            canAdmin={canAdmin}
            onEditDesk={() => setDeskWizard({ desk: selected })}
            onOpenDialog={setDialog}
          />
        ) : (
          <Panel title={t("detail")}>
            <p className="text-sm text-[var(--muted-foreground)]">{t("selectADesk")}</p>
          </Panel>
        )}
      </div>

      {canAdmin && selected ? (
        <DeskTemplatesPanel
          deskName={selected.name}
          messages={templates.messages}
          notes={templates.notes}
          onOpenDialog={setDialog}
          onDeleteMessage={(template) => setPendingDeleteMessage(template)}
          onDeleteNote={(template) => setPendingDeleteNote(template)}
        />
      ) : null}

      {deskWizard ? (
        <DeskWizard
          desk={deskWizard.desk}
          onClose={() => setDeskWizard(null)}
          onSaved={afterDeskSaved}
        />
      ) : null}
      {dialog && selected ? (
        <DeskDialogs
          dialog={dialog}
          desk={selected}
          onClose={() => setDialog(null)}
          onDetailChanged={() => openDesk(selected.id)}
          onTemplatesChanged={() => loadTemplates(selected.id)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDeleteMessage !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMessage(null);
        }}
        title={t("deleteMessageTemplate")}
        description={t("deleteMessageTemplateConfirm")}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        closeLabel={tCommon("close")}
        workingLabel={tCommon("saving")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteMessage) return;
          await deleteMessageTemplate(pendingDeleteMessage);
        }}
      />
      <ConfirmDialog
        open={pendingDeleteNote !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteNote(null);
        }}
        title={t("deleteNoteTemplate")}
        description={t("deleteNoteTemplateConfirm")}
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        closeLabel={tCommon("close")}
        workingLabel={tCommon("saving")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteNote) return;
          await deleteNoteTemplate(pendingDeleteNote);
        }}
      />
    </div>
  );
}
