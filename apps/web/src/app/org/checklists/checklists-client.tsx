"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
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
import { toastError, toastInfo } from "@/lib/toast";
import { CreateTemplateDialog } from "./create-template-dialog";
import type { ChecklistTemplate } from "./checklist-types";

type LiveTemplate = ChecklistTemplate & {
  versions?: { id: number; version: number }[];
};

type ChecklistsPayload = {
  data: LiveTemplate[];
};


function normalizeTemplate(row: LiveTemplate): ChecklistTemplate {
  return {
    ...row,
    slug: row.slug ?? "",
    current_version:
      row.current_version ??
      row.versions?.[0]?.version ??
      1,
  };
}

function templateCells(template: ChecklistTemplate): Record<string, string> {
  return {
    name: template.name,
    category: template.category,
    status: template.status,
    description: template.description ?? "",
  };
}

export function ChecklistsClient() {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const CATEGORY_OPTIONS = [
    { label: t("onboarding"), value: "onboarding" },
    { label: t("offboarding"), value: "offboarding" },
    { label: t("hrOps"), value: "hr_ops" },
    { label: t("custom"), value: "custom" },
  ];
  const STATUS_OPTIONS = [
    { label: tCommon("draft"), value: "draft" },
    { label: tCommon("published"), value: "published" },
    { label: tCommon("archived"), value: "archived" },
  ];
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "checklists") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const canManageChecklists = hasPermission(session, "org.checklists.manage");
  const [custom, setCustom] = useState<ChecklistTemplate[]>([]);
  const [liveAll, setLiveAll] = useState<ChecklistTemplate[] | null>(null);
  const [customMeta, setCustomMeta] = useState<PaginationMeta>(emptyMeta());
  const [customPage, setCustomPage] = useState(1);
  const [customPerPage, setCustomPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [system, setSystem] = useState<ChecklistTemplate[]>([]);
  const [systemMeta, setSystemMeta] = useState<PaginationMeta>(emptyMeta());
  const [systemPage, setSystemPage] = useState(1);
  const [systemPerPage, setSystemPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [createOpen, setCreateOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const customQuery = useDataTableQuery();
  const systemQuery = useDataTableQuery();
  const customFilters = useMemo(
    () => serializeDataTableQuery(customQuery.debounced),
    [customQuery.debounced],
  );
  const systemFilters = useMemo(
    () => serializeDataTableQuery(systemQuery.debounced),
    [systemQuery.debounced],
  );
  const customFiltersKey = useMemo(() => JSON.stringify(customFilters), [customFilters]);
  const systemFiltersKey = useMemo(() => JSON.stringify(systemFilters), [systemFilters]);
  const customFiltersKeyRef = useRef(customFiltersKey);
  const systemFiltersKeyRef = useRef(systemFiltersKey);

  const applyLiveSlices = useCallback(
    (
      items: ChecklistTemplate[],
      nextCustomPage: number,
      nextCustomPerPage: number,
      nextSystemPage: number,
      nextSystemPerPage: number,
      nextCustomQ: string,
      nextCustomColumnFilters: Record<string, string>,
      nextSystemQ: string,
      nextSystemColumnFilters: Record<string, string>,
    ) => {
      const customItems = items
        .filter((t) => !t.is_system)
        .filter((t) => matchesCells(nextCustomQ, nextCustomColumnFilters, templateCells(t)));
      const systemItems = items
        .filter((t) => t.is_system)
        .filter((t) => matchesCells(nextSystemQ, nextSystemColumnFilters, templateCells(t)));
      const customSliced = paginateLocal(customItems, nextCustomPage, nextCustomPerPage);
      const systemSliced = paginateLocal(systemItems, nextSystemPage, nextSystemPerPage);
      setCustom(customSliced.data);
      setCustomMeta(customSliced.meta);
      setCustomPage(customSliced.meta.current_page);
      setSystem(systemSliced.data);
      setSystemMeta(systemSliced.meta);
      setSystemPage(systemSliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: ChecklistsPayload) => {
    const items = Array.isArray(payload.data)
      ? payload.data.map((row) => normalizeTemplate(row))
      : [];
    setLiveAll(items);
  }, []);

  const refreshFromApi = useCallback(
    async (
      nextCustomPage: number,
      nextCustomPerPage: number,
      nextSystemPage: number,
      nextSystemPerPage: number,
      nextCustomFilters: Record<string, string>,
      nextSystemFilters: Record<string, string>,
    ) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      setSession(me);
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const customParams = paginationQuery(nextCustomPage, nextCustomPerPage, {
        editable_only: 1,
        ...nextCustomFilters,
      });
      const systemParams = paginationQuery(nextSystemPage, nextSystemPerPage, {
        system_only: 1,
        ...nextSystemFilters,
      });
      const [customList, systemList] = await Promise.all([
        api(`/api/v1/org/checklists/templates?${customParams}`, { tenant: t }),
        api(`/api/v1/org/checklists/templates?${systemParams}`, { tenant: t }),
      ]);
      const customParsed = parsePaginatedResponse<ChecklistTemplate>(customList, nextCustomPerPage);
      const systemParsed = parsePaginatedResponse<ChecklistTemplate>(systemList, nextSystemPerPage);
      setCustom(customParsed.data);
      setCustomMeta(customParsed.meta);
      setCustomPage(customParsed.meta.current_page);
      setSystem(systemParsed.data);
      setSystemMeta(systemParsed.meta);
      setSystemPage(systemParsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<ChecklistsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    let reset = false;
    if (customFiltersKeyRef.current !== customFiltersKey) {
      customFiltersKeyRef.current = customFiltersKey;
      if (customPage !== 1) {
        setCustomPage(1);
        reset = true;
      }
    }
    if (systemFiltersKeyRef.current !== systemFiltersKey) {
      systemFiltersKeyRef.current = systemFiltersKey;
      if (systemPage !== 1) {
        setSystemPage(1);
        reset = true;
      }
    }
    if (reset) return;

    if (liveAll !== null) {
      applyLiveSlices(
        liveAll,
        customPage,
        customPerPage,
        systemPage,
        systemPerPage,
        customQuery.debounced.q,
        customQuery.debounced.columnFilters,
        systemQuery.debounced.q,
        systemQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(
      customPage,
      customPerPage,
      systemPage,
      systemPerPage,
      customFilters,
      systemFilters,
    )
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [
    liveAll,
    customPage,
    customPerPage,
    systemPage,
    systemPerPage,
    customFilters,
    systemFilters,
    customFiltersKey,
    systemFiltersKey,
    applyLiveSlices,
    refreshFromApi,
    customQuery.debounced,
    systemQuery.debounced,
  ]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  async function copySystem(id: number) {
    try {
      await ensureCsrf();
      const copied = await api<{ data: ChecklistTemplate }>(
        `/api/v1/org/checklists/templates/${id}/from-system`,
        {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      toastInfo(t("templateCopied"));
      window.location.href = `/org/checklists/${copied.data.id}`;
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("copyFailed"));
    }
  }

  const sharedColumns: Array<DataTableColumn<ChecklistTemplate>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (template) => template.name,
    },
    {
      id: "category",
      header: tCommon("category"),
      filter: "select",
      filterOptions: CATEGORY_OPTIONS,
      accessorKey: "category",
      cell: (template) => template.category,
    },
    {
      id: "status",
      header: tCommon("status"),
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      accessorKey: "status",
      cell: (template) => template.status,
    },
    {
      id: "description",
      header: tCommon("descriptionLabel"),
      accessorKey: "description",
      className: "max-w-xs truncate",
      cell: (template) => template.description || tCommon("emDash"),
    },
  ];

  const customColumns: Array<DataTableColumn<ChecklistTemplate>> = [
    ...sharedColumns,
    {
      id: "version",
      header: tCommon("version"),
      filter: "none",
      enableSorting: false,
      cell: (template) => `v${template.current_version}`,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (template) => (
        <LinkButton href={`/org/checklists/${template.id}`} variant="outline" size="compact">
          {tCommon("edit")}
        </LinkButton>
      ),
    },
  ];

  const systemColumns: Array<DataTableColumn<ChecklistTemplate>> = [
    ...sharedColumns,
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (template) => (
        <Button
          type="button"
          variant="outline"
          size="compact"
          disabled={!canManageChecklists}
          onClick={() => setCopyTarget(template)}
        >
          {t("useTemplate")}
        </Button>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
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
            <LinkButton href="/org/checklists/packs" variant="secondary">
              {t("packs")}
            </LinkButton>
            <LinkButton href="/org/checklists/instances" variant="secondary">
              {t("openInstances")}
            </LinkButton>
            {canManageChecklists ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                {t("newTemplate")}
              </Button>
            ) : null}
          </div>
        }
      />

      {createOpen ? <CreateTemplateDialog onClose={() => setCreateOpen(false)} /> : null}

      {copyTarget ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setCopyTarget(null);
          }}
          title={t("copyTemplateTitle")}
          description={t("copyTemplateDescription", { name: copyTarget.name })}
          confirmLabel={t("useTemplate")}
          cancelLabel={tCommon("cancel")}
          workingLabel={tCommon("working")}
          onConfirm={() => copySystem(copyTarget.id)}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("yourTemplates")}</h2>
        <DataTable
          mode="server"
          caption={t("customTemplatesCaption")}
          columns={customColumns}
          rows={custom}
          filterState={customQuery.state}
          onFilterStateChange={customQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noCustomTemplates")}
          pagination={{
            page: customPage,
            perPage: customPerPage,
            total: customMeta.total,
            onPageChange: setCustomPage,
            onPerPageChange: (size) => {
              setCustomPerPage(size);
              setCustomPage(1);
            },
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("hrSystemTemplates")}</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("systemTemplatesHint")}
        </p>
        <DataTable
          mode="server"
          caption={t("systemTemplatesCaption")}
          columns={systemColumns}
          rows={system}
          filterState={systemQuery.state}
          onFilterStateChange={systemQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noSystemTemplates")}
          pagination={{
            page: systemPage,
            perPage: systemPerPage,
            total: systemMeta.total,
            onPageChange: setSystemPage,
            onPerPageChange: (size) => {
              setSystemPerPage(size);
              setSystemPage(1);
            },
          }}
        />
      </section>
    </div>
  );
}
