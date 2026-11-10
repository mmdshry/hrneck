"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select } from "@/components/ui/select";
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
import { resolveTenant } from "@/lib/tenant";

type Department = {
  id: number;
  name: string;
  is_active?: boolean;
  targets_count?: number;
};

type DepartmentsPayload = {
  data: Department[];
};

const ACTIVE_OPTIONS = [
  { label: "Active", value: "1" },
  { label: "Inactive", value: "0" },
];

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid|unauthorized|rejected|denied|cannot)\b/.test(m) ||
    m.includes("load failed")
  ) {
    return "destructive";
  }
  if (/\b(created|saved|updated|deleted)\b/.test(m)) {
    return "success";
  }
  return "default";
}

function departmentCells(department: Department): Record<string, string> {
  return {
    name: department.name,
    is_active: department.is_active === false ? "0" : "1",
    targets_count: String(department.targets_count ?? 0),
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

export function DepartmentsClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "departments") : null;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [liveDepartments, setLiveDepartments] = useState<Department[] | null>(null);
  const [departmentsMeta, setDepartmentsMeta] = useState<PaginationMeta>(emptyMeta());
  const [departmentsPage, setDepartmentsPage] = useState(1);
  const [departmentsPerPage, setDepartmentsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
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
      items: Department[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((department) =>
        matchesCells(q, columnFilters, departmentCells(department)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setDepartments(sliced.data);
      setDepartmentsMeta(sliced.meta);
      setDepartmentsPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: DepartmentsPayload) => {
    setLiveDepartments(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const res = await api(
        `/api/v1/org/departments?${paginationQuery(nextPage, nextPerPage, nextFilters)}`,
        { tenant: t },
      );
      const parsed = parsePaginatedResponse<Department>(res, nextPerPage);
      setDepartments(parsed.data);
      setDepartmentsMeta(parsed.meta);
      setDepartmentsPage(parsed.meta.current_page);
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<DepartmentsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (departmentsPage !== 1) {
        setDepartmentsPage(1);
        return;
      }
    }
    if (liveDepartments !== null) {
      applyLiveSlice(
        liveDepartments,
        departmentsPage,
        departmentsPerPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshFromApi(departmentsPage, departmentsPerPage, filters)
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [
    liveDepartments,
    departmentsPage,
    departmentsPerPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function afterMutation(nextPage = departmentsPage) {
    if (liveDepartments === null) {
      await refreshFromApi(nextPage, departmentsPerPage, filters);
    }
  }

  function openCreateModal() {
    setEditing(null);
    setName("");
    setIsActive(true);
    setModalOpen(true);
  }

  function openEditModal(department: Department) {
    setEditing(department);
    setName(department.name);
    setIsActive(department.is_active !== false);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setName("");
    setIsActive(true);
  }

  async function saveDepartment(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await ensureCsrf();
      const t = resolveTenant();
      const payload = {
        name: name.trim(),
        is_active: isActive,
      };
      if (editing) {
        await api(`/api/v1/org/departments/${editing.id}`, {
          method: "PATCH",
          tenant: t,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Department updated.");
      } else {
        await api("/api/v1/org/departments", {
          method: "POST",
          tenant: t,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Department created.");
        setDepartmentsPage(1);
      }
      setModalOpen(false);
      setEditing(null);
      setName("");
      setIsActive(true);
      await afterMutation(editing ? departmentsPage : 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Department failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(department: Department) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/departments/${department.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setMessage("Department deleted.");
      await afterMutation();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  const columns: Array<DataTableColumn<Department>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (department) => department.name,
    },
    {
      id: "is_active",
      header: "Status",
      filter: "select",
      filterOptions: ACTIVE_OPTIONS,
      filterValue: (department) => (department.is_active === false ? "0" : "1"),
      cell: (department) => (department.is_active === false ? "Inactive" : "Active"),
    },
    {
      id: "targets_count",
      header: "Employees",
      filter: "none",
      filterValue: (department) => department.targets_count ?? 0,
      cell: (department) => department.targets_count ?? 0,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (department) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => openEditModal(department)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => setPendingDelete(department)}
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
        title="Departments"
        description={
          statusLabel ?? "Manage departments and select them when adding employees."
        }
        actions={
          <Button type="button" onClick={openCreateModal}>
            Add department
          </Button>
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

      <section className="mt-10">
        <DataTable
          mode="server"
          caption="Departments"
          columns={columns}
          rows={departments}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle="No departments yet"
          emptyDescription="Create a department, then assign it on the Employees page."
          pagination={{
            page: departmentsPage,
            perPage: departmentsPerPage,
            total: departmentsMeta.total,
            onPageChange: setDepartmentsPage,
            onPerPageChange: (size) => {
              setDepartmentsPerPage(size);
              setDepartmentsPage(1);
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
        title={editing ? "Edit department" : "Add department"}
        description="Departments appear as selectable options on employee forms."
        dismissible={!saving}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="department-form" disabled={saving || !name.trim()}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add department"}
            </Button>
          </>
        }
      >
        <form id="department-form" onSubmit={(e) => void saveDepartment(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="department-name">Name</Label>
            <Input
              id="department-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="department-active">Status</Label>
            <Select
              id="department-active"
              value={isActive ? "1" : "0"}
              onChange={(e) => setIsActive(e.target.value === "1")}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete department"
        description={`Delete department ${pendingDelete?.name}? Employees must be unassigned first.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteDepartment(pendingDelete);
        }}
      />
    </div>
  );
}
