"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, signOut as apiSignOut } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { clearTenant, setTenant } from "@/lib/tenant";

type TenantRow = {
  id: string;
  name: string;
  industry?: string | null;
  employee_band?: string | null;
  status: string;
  training_enabled: boolean;
  domains?: string[];
};

type MspPayload = {
  data: TenantRow[];
};

const EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

const SELECT_FILTERS = new Set(["employee_band", "status", "training_enabled"]);

function tenantCells(tenant: TenantRow): Record<string, string> {
  return {
    name: tenant.name,
    industry: tenant.industry ?? "",
    employee_band: tenant.employee_band ?? "",
    status: tenant.status,
    training_enabled: tenant.training_enabled ? "on" : "off",
  };
}

function matchesTenant(
  tenant: TenantRow,
  q: string,
  columnFilters: Record<string, string>,
): boolean {
  const cells = tenantCells(tenant);
  const needle = q.trim().toLowerCase();
  if (needle) {
    const hay = [cells.name, cells.industry, cells.status, cells.employee_band]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  for (const [key, raw] of Object.entries(columnFilters)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    const cell = String(cells[key] ?? "").toLowerCase();
    if (SELECT_FILTERS.has(key)) {
      if (cell !== value) return false;
    } else if (!cell.includes(value)) {
      return false;
    }
  }
  return true;
}

const columns: Array<DataTableColumn<TenantRow>> = [
  {
    id: "name",
    header: "Name",
    accessorKey: "name",
    sticky: true,
    cell: (tenant) => (
      <div className="min-w-0">
        <div className="font-medium">{tenant.name}</div>
        <div className="text-xs text-[var(--muted-foreground)]">{tenant.id}.hrneck.test</div>
      </div>
    ),
  },
  {
    id: "industry",
    header: "Industry",
    accessorKey: "industry",
    cell: (tenant) => tenant.industry || "—",
  },
  {
    id: "employee_band",
    header: "Employees",
    accessorKey: "employee_band",
    filter: "select",
    filterOptions: EMPLOYEE_BANDS.map((band) => ({ label: band, value: band })),
    enableSorting: false,
    cell: (tenant) => tenant.employee_band || "—",
  },
  {
    id: "status",
    header: "Status",
    accessorKey: "status",
    filter: "select",
    filterOptions: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
    cell: (tenant) => tenant.status,
  },
  {
    id: "training_enabled",
    header: "Training",
    filter: "select",
    filterOptions: [
      { label: "On", value: "on" },
      { label: "Off", value: "off" },
    ],
    filterValue: (tenant) => (tenant.training_enabled ? "on" : "off"),
    enableSorting: false,
    cell: (tenant) => (tenant.training_enabled ? "On" : "Off"),
  },
];

export function MspClient() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [liveTenants, setLiveTenants] = useState<TenantRow[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [signingOut, setSigningOut] = useState(false);
  const [enteringTenant, setEnteringTenant] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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
      items: TenantRow[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((tenant) => matchesTenant(tenant, q, columnFilters));
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setTenants(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: MspPayload) => {
    setLiveTenants(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const res = await api(`/api/v1/msp/tenants?${paginationQuery(nextPage, nextPerPage, nextFilters)}`);
      const parsed = parsePaginatedResponse<TenantRow>(res, nextPerPage);
      setTenants(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error } = useLiveTopic<MspPayload>({
    channel: "msp.live",
    onPayload,
  });

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveTenants !== null) {
      applyLiveSlice(
        liveTenants,
        page,
        perPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(page, perPage, filters)
      .catch(() => {
        /* live channel may still populate */
      })
      .finally(() => setLoading(false));
  }, [
    liveTenants,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);
  const waitingForLive = liveTenants === null && status !== "live";

  async function enterTenant(tenantId: string) {
    setActionError(null);
    setEnteringTenant(tenantId);
    try {
      await ensureCsrf();
      await api(`/api/v1/msp/tenants/${tenantId}/enter`, { method: "POST" });
      setTenant(tenantId);
      window.location.assign(`/org?tenant=${encodeURIComponent(tenantId)}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to enter tenant");
      setEnteringTenant(null);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await apiSignOut();
      clearTenant();
      window.location.replace("/login");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Sign out failed");
      setSigningOut(false);
    }
  }

  const tableColumns: Array<DataTableColumn<TenantRow>> = [
    ...columns,
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (tenant) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={enteringTenant === tenant.id}
          onClick={() => void enterTenant(tenant.id)}
        >
          {enteringTenant === tenant.id ? "Opening…" : "Open tenant admin"}
        </Button>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Organizations"
        description="MSP workspace for every managed tenant."
        actions={
          <Button
            type="button"
            variant="ghost"
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        }
      />
      <p className="mt-2 text-sm uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        MSP workspace
        {statusLabel ? ` · ${statusLabel}` : " · Live"}
      </p>
      {error ? (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert className="mt-4" variant="destructive">
          {actionError}
        </Alert>
      ) : null}
      <DataTable
        className="mt-8"
        mode="server"
        caption="Organizations"
        columns={tableColumns}
        rows={tenants}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle={
          waitingForLive ? (statusLabel ?? "Waiting for live data…") : "No organizations yet"
        }
        emptyDescription={
          waitingForLive ? undefined : "Create a tenant in the admin panel."
        }
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
