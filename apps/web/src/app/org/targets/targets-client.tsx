"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select } from "@/components/ui/select";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
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
import { resolveTenant } from "@/lib/tenant";

type DepartmentOption = {
  id: number;
  name: string;
  is_active?: boolean;
};

type Target = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  department_id?: number | null;
  status?: string;
  risk_score?: number;
};

type TargetsPayload = {
  data: Target[];
};

const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid|unauthorized|rejected|denied)\b/.test(m) ||
    m.includes("load failed") ||
    m.includes("sync failed") ||
    m.includes("import failed")
  ) {
    return "destructive";
  }
  if (
    /\b(synced|imported|created|saved|updated|archived|deleted)\b/.test(m) ||
    m.includes("rows.")
  ) {
    return "success";
  }
  return "default";
}

function targetCells(target: Target): Record<string, string> {
  return {
    email: target.email,
    first_name: target.first_name ?? "",
    last_name: target.last_name ?? "",
    department: target.department ?? "",
    status: target.status ?? "",
    risk_score: String(target.risk_score ?? 0),
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

export function TargetsClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "targets") : null;
  const [targets, setTargets] = useState<Target[]>([]);
  const [liveTargets, setLiveTargets] = useState<Target[] | null>(null);
  const [targetsMeta, setTargetsMeta] = useState<PaginationMeta>(emptyMeta());
  const [targetsPage, setTargetsPage] = useState(1);
  const [targetsPerPage, setTargetsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Target | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<Target | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [saving, setSaving] = useState(false);
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
      items: Target[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((target) =>
        matchesCells(q, columnFilters, targetCells(target)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setTargets(sliced.data);
      setTargetsMeta(sliced.meta);
      setTargetsPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: TargetsPayload) => {
    setLiveTargets(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const res = await api(`/api/v1/org/targets?${paginationQuery(nextPage, nextPerPage, nextFilters)}`, {
        tenant: t,
      });
      const targetsParsed = parsePaginatedResponse<Target>(res, nextPerPage);
      setTargets(targetsParsed.data);
      setTargetsMeta(targetsParsed.meta);
      setTargetsPage(targetsParsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<TargetsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (targetsPage !== 1) {
        setTargetsPage(1);
        return;
      }
    }
    if (liveTargets !== null) {
      applyLiveSlice(
        liveTargets,
        targetsPage,
        targetsPerPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(targetsPage, targetsPerPage, filters)
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [
    liveTargets,
    targetsPage,
    targetsPerPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function afterMutation(nextPage = targetsPage) {
    if (liveTargets === null) {
      await refreshFromApi(nextPage, targetsPerPage, filters);
    }
  }

  const loadDepartments = useCallback(async () => {
    const t = resolveTenant();
    const res = await api(`/api/v1/org/departments?${paginationQuery(1, 500, { active_only: "1" })}`, {
      tenant: t,
    });
    const parsed = parsePaginatedResponse<DepartmentOption>(res, 500);
    setDepartments(parsed.data.filter((department) => department.is_active !== false));
  }, []);

  function openCreateModal() {
    setEmail("");
    setFirstName("");
    setLastName("");
    setDepartmentId("");
    setModalOpen(true);
    void loadDepartments().catch((err: unknown) => {
      setMessage(err instanceof Error ? err.message : "Failed to load departments");
    });
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEmail("");
    setFirstName("");
    setLastName("");
    setDepartmentId("");
  }

  async function createTarget(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await ensureCsrf();
      const res = await api<{
        data: Target;
        meta?: { auto_assigned_instance_count?: number };
      }>("/api/v1/org/targets", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          department_id: departmentId ? Number(departmentId) : null,
        }),
      });
      const autoCount = res.meta?.auto_assigned_instance_count ?? 0;
      setMessage(
        autoCount > 0
          ? `Employee created. Auto-assigned ${autoCount} checklist instance${autoCount === 1 ? "" : "s"}.`
          : "Employee created.",
      );
      setModalOpen(false);
      setEmail("");
      setFirstName("");
      setLastName("");
      setDepartmentId("");
      setTargetsPage(1);
      await afterMutation(1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function syncDirectory() {
    setMessage(null);
    try {
      await ensureCsrf();
      const res = await api<{ data: { users: number; groups: number } }>(
        "/api/v1/org/directory-sync",
        { method: "POST", tenant: resolveTenant() },
      );
      setMessage(
        `Synced ${res.data.users} users / ${res.data.groups} groups (mock until cloud credentials).`,
      );
      setTargetsPage(1);
      await afterMutation(1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("csv") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await ensureCsrf();
      const body = new FormData();
      body.append("file", file);
      const res = await api<{
        imported: number;
        meta?: { auto_assigned_instance_count?: number };
      }>("/api/v1/org/targets/import", {
        method: "POST",
        tenant: resolveTenant(),
        body,
      });
      const autoCount = res.meta?.auto_assigned_instance_count ?? 0;
      setMessage(
        autoCount > 0
          ? `Imported ${res.imported} rows. Auto-assigned ${autoCount} checklist instance${autoCount === 1 ? "" : "s"}.`
          : `Imported ${res.imported} rows.`,
      );
      setTargetsPage(1);
      await afterMutation(1);
      form.reset();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "CSV import failed");
    }
  }

  async function archiveTarget(target: Target) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/targets/${target.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      setMessage("Employee archived.");
      await afterMutation();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Archive failed");
      throw err;
    }
  }

  async function deleteTarget(target: Target) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/targets/${target.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setMessage("Employee deleted.");
      await afterMutation();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  const columns: Array<DataTableColumn<Target>> = [
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      sticky: true,
      cell: (target) => target.email,
    },
    {
      id: "first_name",
      header: "First name",
      accessorKey: "first_name",
      cell: (target) => target.first_name || "—",
    },
    {
      id: "last_name",
      header: "Last name",
      accessorKey: "last_name",
      cell: (target) => target.last_name || "—",
    },
    {
      id: "department",
      header: "Department",
      accessorKey: "department",
      cell: (target) => target.department || "—",
    },
    {
      id: "status",
      header: "Status",
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      accessorKey: "status",
      cell: (target) => target.status || "—",
    },
    {
      id: "risk_score",
      header: "Risk",
      filterValue: (target) => target.risk_score ?? 0,
      cell: (target) => target.risk_score ?? 0,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (target) => (
        <div className="flex items-center gap-2">
          <LinkButton href={`/org/targets/${target.id}`} size="sm" variant="secondary">
            Open
          </LinkButton>
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => setPendingArchive(target)}
          >
            Archive
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => setPendingDeleteTarget(target)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Employees"
        description={statusLabel ?? "Manage employees, CSV upload, and mock directory sync."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={openCreateModal}>
              Add employee
            </Button>
            <Button type="button" onClick={() => void syncDirectory()}>
              Run directory sync
            </Button>
          </div>
        }
      />
      {message ? (
        <Alert className="mt-4" variant={alertVariantForMessage(message)}>
          {message}
        </Alert>
      ) : null}
      {liveError ? (
        <Alert className="mt-4" variant="destructive">
          {liveError}
        </Alert>
      ) : null}
      <form onSubmit={uploadCsv} className="mt-6 flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="targets-csv" className="text-[var(--muted-foreground)]">
            CSV import
          </Label>
          <Input id="targets-csv" name="csv" type="file" accept=".csv,text/csv" />
        </div>
        <Button type="submit" variant="secondary">
          Upload CSV
        </Button>
      </form>
      <section className="mt-10">
        <h2 className="text-xl font-medium text-[var(--foreground)]">Employees</h2>
        <DataTable
          className="mt-4"
          mode="server"
          caption="Employees"
          columns={columns}
          rows={targets}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle="No employees"
          emptyDescription="Add an employee, upload a CSV, or run directory sync."
          pagination={{
            page: targetsPage,
            perPage: targetsPerPage,
            total: targetsMeta.total,
            onPageChange: setTargetsPage,
            onPerPageChange: (size) => {
              setTargetsPerPage(size);
              setTargetsPage(1);
            },
          }}
        />
      </section>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
          else setModalOpen(true);
        }}
        title="Add employee"
        description="Create a single employee in the training and checklist audience."
        dismissible={!saving}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="target-form" disabled={saving || !email.trim()}>
              {saving ? "Saving…" : "Add employee"}
            </Button>
          </>
        }
      >
        <form id="target-form" onSubmit={(e) => void createTarget(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="target-email">Email</Label>
            <Input
              id="target-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-first-name">First name</Label>
              <Input
                id="target-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-last-name">Last name</Label>
              <Input
                id="target-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="target-department">Department</Label>
            <Select
              id="target-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArchive(null);
        }}
        title="Archive employee"
        description={`Archive ${pendingArchive?.email}?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!pendingArchive) return;
          await archiveTarget(pendingArchive);
        }}
      />

      <ConfirmDialog
        open={pendingDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTarget(null);
        }}
        title="Delete employee"
        description={`Permanently delete ${pendingDeleteTarget?.email}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteTarget) return;
          await deleteTarget(pendingDeleteTarget);
        }}
      />
    </div>
  );
}
