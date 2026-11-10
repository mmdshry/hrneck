"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudiencePicker,
  type AudienceGroup,
  type AudienceTarget,
} from "@/app/org/training/audience-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
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
import { resolveTenant } from "@/lib/tenant";
import type {
  ChecklistInstance,
  ChecklistPack,
  ChecklistTemplate,
} from "../checklist-types";

type InstancesPayload = {
  data: ChecklistInstance[];
};

const STATUS_OPTIONS = [
  { label: "Not started", value: "not_started" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

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

function instanceCells(row: ChecklistInstance): Record<string, string> {
  return {
    title: row.title,
    email: row.target?.email ?? "",
    status: row.status,
  };
}

export function ChecklistInstancesClient() {
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
  const [assignMode, setAssignMode] = useState<"template" | "pack">("template");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [packId, setPackId] = useState<number | "">("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
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
    setTemplateId((current) => current || tpl?.data?.[0]?.id || "");
    setPackId((current) => current || nextPacks[0]?.id || "");
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
      setMessage(err instanceof Error ? err.message : "Load failed");
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
        setMessage(err instanceof Error ? err.message : "Load failed");
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

  const statusLabel = liveStatusLabel(status);

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (assignMode === "template" && !templateId) return;
    if (assignMode === "pack" && !packId) return;
    setMessage(null);
    try {
      await ensureCsrf();
      if (assignMode === "pack") {
        await api(`/api/v1/org/checklists/packs/${packId}/assign`, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_ids: selectedTargetIds,
            group_ids: selectedGroupIds,
          }),
        });
        setMessage("Pack connected to employees.");
      } else {
        await api("/api/v1/org/checklists/instances", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            target_ids: selectedTargetIds,
            group_ids: selectedGroupIds,
          }),
        });
        setMessage("Checklists connected to employees.");
      }
      setSelectedTargetIds([]);
      setSelectedGroupIds([]);
      setPage(1);
      if (liveInstances === null) {
        await refreshFromApi(1, perPage, filters);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Assign failed");
    }
  }

  const columns: Array<DataTableColumn<ChecklistInstance>> = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      sticky: true,
      cell: (row) => row.title,
    },
    {
      id: "email",
      header: "Employee",
      filterValue: (row) => row.target?.email ?? "",
      cell: (row) =>
        row.target_id ? (
          <LinkButton
            href={`/org/targets/${row.target_id}`}
            variant="link"
            className="h-auto min-h-0 px-0 py-0 text-sm"
          >
            {row.target?.email ?? `Employee #${row.target_id}`}
          </LinkButton>
        ) : (
          "—"
        ),
    },
    {
      id: "status",
      header: "Status",
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      accessorKey: "status",
      cell: (row) => row.status,
    },
    {
      id: "progress",
      header: "Progress",
      filter: "none",
      enableSorting: false,
      cell: (row) => `${row.progress_pct}%`,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <LinkButton href={`/org/checklists/instances/${row.id}`} size="sm">
          Fill / review
        </LinkButton>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.checklists.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklist instances" description="Connect checklists to employees." />
        <Alert>You need org.checklists.manage to manage checklist instances.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Checklist instances"
        description={
          statusLabel
            ? `Connect checklists to employees and fill them as HR. Employees have no access. · ${statusLabel}`
            : "Connect checklists to employees and fill them as HR. Employees have no access."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/checklists/packs" variant="secondary">
              Packs
            </LinkButton>
            <LinkButton href="/org/checklists" variant="secondary">
              Templates
            </LinkButton>
          </div>
        }
      />

      {message ? <Alert>{message}</Alert> : null}
      {liveError ? <Alert variant="destructive">{liveError}</Alert> : null}

      <Panel className="space-y-4 p-4">
        <h2 className="text-sm font-semibold">Connect checklist to employees</h2>
        <form onSubmit={onAssign} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="instance-assign-mode">Assign</Label>
            <Select
              id="instance-assign-mode"
              value={assignMode}
              onChange={(e) => setAssignMode(e.target.value as "template" | "pack")}
            >
              <option value="template">Single template</option>
              <option value="pack">Checklist pack</option>
            </Select>
          </div>
          {assignMode === "pack" ? (
            <div className="space-y-1.5">
              <Label htmlFor="instance-pack">Pack</Label>
              <Select
                id="instance-pack"
                value={packId === "" ? "" : String(packId)}
                onChange={(e) => setPackId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">Select pack</option>
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="instance-template">Template</Label>
              <Select
                id="instance-template"
                value={templateId === "" ? "" : String(templateId)}
                onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">Select template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <AudiencePicker
            targets={targets}
            groups={groups}
            selectedTargetIds={selectedTargetIds}
            selectedGroupIds={selectedGroupIds}
            onChangeTargets={setSelectedTargetIds}
            onChangeGroups={setSelectedGroupIds}
          />
          <Button type="submit">Connect</Button>
        </form>
      </Panel>

      <DataTable
        mode="server"
        caption="Checklist instances"
        columns={columns}
        rows={instances}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle="No instances yet."
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
