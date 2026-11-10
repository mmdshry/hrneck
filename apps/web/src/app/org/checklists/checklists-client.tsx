"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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
import type { ChecklistTemplate } from "./checklist-types";

type LiveTemplate = ChecklistTemplate & {
  versions?: { id: number; version: number }[];
};

type ChecklistsPayload = {
  data: LiveTemplate[];
};

const CATEGORY_OPTIONS = [
  { label: "Onboarding", value: "onboarding" },
  { label: "Offboarding", value: "offboarding" },
  { label: "HR ops", value: "hr_ops" },
  { label: "Custom", value: "custom" },
];

const STATUS_OPTIONS = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

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

function templateCells(template: ChecklistTemplate): Record<string, string> {
  return {
    name: template.name,
    category: template.category,
    status: template.status,
    description: template.description ?? "",
  };
}

export function ChecklistsClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "checklists") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [custom, setCustom] = useState<ChecklistTemplate[]>([]);
  const [liveAll, setLiveAll] = useState<ChecklistTemplate[] | null>(null);
  const [customMeta, setCustomMeta] = useState<PaginationMeta>(emptyMeta());
  const [customPage, setCustomPage] = useState(1);
  const [customPerPage, setCustomPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [system, setSystem] = useState<ChecklistTemplate[]>([]);
  const [systemMeta, setSystemMeta] = useState<PaginationMeta>(emptyMeta());
  const [systemPage, setSystemPage] = useState(1);
  const [systemPerPage, setSystemPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [description, setDescription] = useState("");
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
        setMessage(err instanceof Error ? err.message : "Load failed");
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

  const statusLabel = liveStatusLabel(status);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      const created = await api<{ data: ChecklistTemplate }>("/api/v1/org/checklists/templates", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          description: description || null,
          status: "draft",
          schema_json: { items: [] },
        }),
      });
      setName("");
      setDescription("");
      setMessage("Template created.");
      window.location.href = `/org/checklists/${created.data.id}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function copySystem(id: number) {
    setMessage(null);
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
      setMessage("Template copied. Opening builder…");
      window.location.href = `/org/checklists/${copied.data.id}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Copy failed");
    }
  }

  const sharedColumns: Array<DataTableColumn<ChecklistTemplate>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (template) => template.name,
    },
    {
      id: "category",
      header: "Category",
      filter: "select",
      filterOptions: CATEGORY_OPTIONS,
      accessorKey: "category",
      cell: (template) => template.category,
    },
    {
      id: "status",
      header: "Status",
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      accessorKey: "status",
      cell: (template) => template.status,
    },
    {
      id: "description",
      header: "Description",
      accessorKey: "description",
      className: "max-w-xs truncate",
      cell: (template) => template.description || "—",
    },
  ];

  const customColumns: Array<DataTableColumn<ChecklistTemplate>> = [
    ...sharedColumns,
    {
      id: "version",
      header: "Version",
      filter: "none",
      enableSorting: false,
      cell: (template) => `v${template.current_version}`,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (template) => (
        <LinkButton href={`/org/checklists/${template.id}`} variant="secondary" size="sm">
          Edit
        </LinkButton>
      ),
    },
  ];

  const systemColumns: Array<DataTableColumn<ChecklistTemplate>> = [
    ...sharedColumns,
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (template) => (
        <Button type="button" size="sm" onClick={() => void copySystem(template.id)}>
          Use template
        </Button>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.checklists.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Checklists" description="Internal HR checklists." />
        <Alert>You need org.checklists.manage to manage checklists.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Checklists"
        description={
          statusLabel
            ? `Design flexible HR checklists and fill them for employees. Employees never see these. · ${statusLabel}`
            : "Design flexible HR checklists and fill them for employees. Employees never see these."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/checklists/packs" variant="secondary">
              Packs
            </LinkButton>
            <LinkButton href="/org/checklists/instances" variant="secondary">
              Open instances
            </LinkButton>
          </div>
        }
      />

      {message ? <Alert>{message}</Alert> : null}
      {liveError ? <Alert variant="destructive">{liveError}</Alert> : null}

      <Panel className="p-4">
        <h2 className="mb-3 text-sm font-semibold">New template</h2>
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cl-name">Name</Label>
            <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cl-cat">Category</Label>
            <Select id="cl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="onboarding">Onboarding</option>
              <option value="offboarding">Offboarding</option>
              <option value="hr_ops">HR ops</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cl-desc">Description</Label>
            <Textarea
              id="cl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Button type="submit">Create & design</Button>
          </div>
        </form>
      </Panel>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Your templates</h2>
        <DataTable
          mode="server"
          caption="Custom checklist templates"
          columns={customColumns}
          rows={custom}
          filterState={customQuery.state}
          onFilterStateChange={customQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle="No custom templates yet."
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
        <h2 className="text-sm font-semibold">HR system templates</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Read-only starters. Copy one to customize and assign to employees.
        </p>
        <DataTable
          mode="server"
          caption="System checklist templates"
          columns={systemColumns}
          rows={system}
          filterState={systemQuery.state}
          onFilterStateChange={systemQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle="No system templates."
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
