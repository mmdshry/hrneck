"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastError } from "@/lib/toast";
import { useTranslations } from "next-intl";
import type { AudienceGroup, AudienceTarget } from "@/app/org/training/audience-picker";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import { api, apiOptional, ensureCsrf, fetchSessionUser } from "@/lib/api";
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
import type {
  ChecklistInstance,
  ChecklistPack,
  ChecklistTemplate,
} from "../checklist-types";
import { ConnectChecklistWizard } from "./connect-checklist-wizard";

type InstancesPayload = {
  data: ChecklistInstance[];
};


function instanceCells(row: ChecklistInstance): Record<string, string> {
  return {
    title: row.title,
    email: row.target?.email ?? "",
    status: row.status,
  };
}

export function ChecklistInstancesClient() {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const STATUS_OPTIONS = [
    { label: tCommon("notStarted"), value: "not_started" },
    { label: tCommon("inProgress"), value: "in_progress" },
    { label: tCommon("completed"), value: "completed" },
    { label: tCommon("cancelled"), value: "cancelled" },
  ];
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "checklist-instances") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [packs, setPacks] = useState<ChecklistPack[]>([]);
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [liveInstances, setLiveInstances] = useState<ChecklistInstance[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [targets, setTargets] = useState<AudienceTarget[]>([]);
  const [groups, setGroups] = useState<AudienceGroup[]>([]);
  const [connectOpen, setConnectOpen] = useState(false);
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
      items: ChecklistInstance[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((row) => matchesCells(q, columnFilters, instanceCells(row)));
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setInstances(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: InstancesPayload) => {
    setLiveInstances(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const loadAuxiliary = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;
    const t = resolveTenant();
    const canTargets = hasPermission(me, "org.targets.manage");
    const canGroups = hasPermission(me, "org.groups.manage");
    const [tpl, packRes, targetRes, groupRes] = await Promise.all([
      apiOptional<{ data: ChecklistTemplate[] }>(
        `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
        { tenant: t },
      ),
      apiOptional<{ data: ChecklistPack[] }>(
        `/api/v1/org/checklists/packs?${paginationQuery(1, 100)}`,
        { tenant: t },
      ),
      canTargets
        ? apiOptional<{ data: AudienceTarget[] }>("/api/v1/org/targets?per_page=500", {
            tenant: t,
          })
        : Promise.resolve(null),
      canGroups
        ? apiOptional<{ data: AudienceGroup[] }>("/api/v1/org/groups?per_page=500", {
            tenant: t,
          })
        : Promise.resolve(null),
    ]);
    setTemplates(tpl?.data ?? []);
    const nextPacks = (packRes?.data ?? []).filter((row) => row.status !== "archived");
    setPacks(nextPacks);
    setTargets(
      (targetRes?.data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        first_name: row.first_name,
      })),
    );
    if (groupRes) {
      const groupsParsed = parsePaginatedResponse<AudienceGroup>(groupRes, 500);
      setGroups(groupsParsed.data.length ? groupsParsed.data : (groupRes.data ?? []));
    } else {
      setGroups([]);
    }
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
      const instanceQuery = paginationQuery(nextPage, nextPerPage, nextFilters);
      const inst = await api(`/api/v1/org/checklists/instances?${instanceQuery}`, {
        tenant: t,
      });
      const parsed = parsePaginatedResponse<ChecklistInstance>(inst, nextPerPage);
      setInstances(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<InstancesPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void loadAuxiliary().catch((err: unknown) => {
      toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
    });
  }, [loadAuxiliary]);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveInstances !== null) {
      applyLiveSlice(
        liveInstances,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [
    liveInstances,
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

  async function handleConnected() {
    setPage(1);
    if (liveInstances === null) {
      await refreshFromApi(1, perPage, filters);
    }
  }

  const columns: Array<DataTableColumn<ChecklistInstance>> = [
    {
      id: "title",
      header: tCommon("titleLabel"),
      accessorKey: "title",
      sticky: true,
      cell: (row) => row.title,
    },
    {
      id: "email",
      header: tCommon("employee"),
      filterValue: (row) => row.target?.email ?? "",
      cell: (row) =>
        row.target_id ? (
          <LinkButton
            href={`/org/targets/${row.target_id}`}
            variant="link"
            className="h-auto min-h-0 px-0 py-0 text-sm"
          >
            {row.target?.email ?? t("employeeFallback", { id: String(row.target_id) })}
          </LinkButton>
        ) : (
          tCommon("emDash")
        ),
    },
    {
      id: "status",
      header: tCommon("status"),
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      accessorKey: "status",
      cell: (row) => row.status,
    },
    {
      id: "progress",
      header: tCommon("progress"),
      filter: "none",
      enableSorting: false,
      cell: (row) => `${row.progress_pct}%`,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <LinkButton
          href={`/org/checklists/instances/${row.id}`}
          variant="outline"
          size="compact"
        >
          {tCommon("fillReview")}
        </LinkButton>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  const canManageChecklists = hasPermission(session, "org.checklists.manage");

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("instancesTitle")}
        description={
          statusLabel
            ? `${t("instancesDescription")} · ${statusLabel}`
            : t("instancesDescription")
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/checklists/packs" variant="secondary">
              {t("packs")}
            </LinkButton>
            <LinkButton href="/org/checklists" variant="secondary">
              {t("templates")}
            </LinkButton>
            {canManageChecklists ? (
              <Button type="button" onClick={() => setConnectOpen(true)}>
                {t("connectChecklist")}
              </Button>
            ) : null}
          </div>
        }
      />

      {connectOpen ? (
        <ConnectChecklistWizard
          templates={templates}
          packs={packs}
          targets={targets}
          groups={groups}
          onConnected={handleConnected}
          onClose={() => setConnectOpen(false)}
        />
      ) : null}

      <DataTable
        mode="server"
        caption={t("instancesCaption")}
        columns={columns}
        rows={instances}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle={t("noInstancesYet")}
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
