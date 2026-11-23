"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastSuccess, toastError, toastInfo } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { LocationSelect } from "@/components/ui/location-select";
import { Select } from "@/components/ui/select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
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
import { ImportWizardDialog } from "./import/import-wizard-dialog";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  PREFERRED_LANGUAGE_OPTIONS,
  RISK_TIER_OPTIONS,
  emptyTargetForm,
  formFromTarget,
  languageLabel,
  payloadFromForm,
  type DepartmentOption,
  type Target,
  type TargetFormState,
} from "./target-types";

type TargetsPayload = {
  data: Target[];
};

function formatDateCell(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDateTimeCell(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).replace("T", " ").slice(0, 19);
}

function managerLabel(target: Target): string {
  if (!target.manager) return "";
  const name = [target.manager.first_name, target.manager.last_name].filter(Boolean).join(" ").trim();
  return name || target.manager.email || "";
}

function groupsLabel(target: Target): string {
  return target.groups?.map((group) => group.name).filter(Boolean).join(", ") ?? "";
}

function targetCells(target: Target): Record<string, string> {
  return {
    email: target.email,
    first_name: target.first_name ?? "",
    last_name: target.last_name ?? "",
    employee_number: target.employee_number ?? "",
    job_title: target.job_title ?? "",
    department: target.department ?? "",
    manager: managerLabel(target),
    phone: target.phone ?? "",
    location: target.location ?? "",
    employment_type: target.employment_type ?? "",
    hire_date: formatDateCell(target.hire_date),
    preferred_language: languageLabel(target.preferred_language),
    timezone: target.timezone ?? "",
    external_id: target.external_id ?? "",
    status: target.status ?? "",
    risk_score: String(target.risk_score ?? 0),
    risk_tier: target.risk_tier ?? "",
    risk_source: target.risk_source ?? "",
    risk_updated_at: formatDateTimeCell(target.risk_updated_at),
    last_training_completed_at: formatDateTimeCell(target.last_training_completed_at),
    notification_opt_out: target.notification_opt_out ? "yes" : "no",
    joined_via: target.joined_via ?? "",
    user_id: target.user_id != null ? String(target.user_id) : "",
    groups: groupsLabel(target),
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
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const statusOptions = [
    { label: tCommon("active"), value: "active" },
    { label: tCommon("inactive"), value: "inactive" },
  ];
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "targets") : null;
  const [targets, setTargets] = useState<Target[]>([]);
  const [managerOptions, setManagerOptions] = useState<Target[]>([]);
  const [liveTargets, setLiveTargets] = useState<Target[] | null>(null);
  const [targetsMeta, setTargetsMeta] = useState<PaginationMeta>(emptyMeta());
  const [targetsPage, setTargetsPage] = useState(1);
  const [targetsPerPage, setTargetsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [pendingArchive, setPendingArchive] = useState<Target | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<Target | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Target | null>(null);
  const [form, setForm] = useState<TargetFormState>(emptyTargetForm());
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
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
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

  const loadManagerOptions = useCallback(async () => {
    const t = resolveTenant();
    const res = await api(`/api/v1/org/targets?${paginationQuery(1, 500)}`, { tenant: t });
    const parsed = parsePaginatedResponse<Target>(res, 500);
    setManagerOptions(parsed.data);
  }, []);

  function patchForm<K extends keyof TargetFormState>(key: K, value: TargetFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreateModal() {
    setEditing(null);
    setForm(emptyTargetForm());
    setModalOpen(true);
    void Promise.all([loadDepartments(), loadManagerOptions()]).catch((err: unknown) => {
      toastError(err instanceof Error ? err.message : t("failedFormOptions"));
    });
  }

  function openEditModal(target: Target) {
    setEditing(target);
    setForm(formFromTarget(target));
    setModalOpen(true);
    void Promise.all([loadDepartments(), loadManagerOptions()]).catch((err: unknown) => {
      toastError(err instanceof Error ? err.message : t("failedFormOptions"));
    });
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyTargetForm());
  }

  async function saveTarget(event: FormEvent) {
    event.preventDefault();
    
    setSaving(true);
    try {
      await ensureCsrf();
      if (editing) {
        await api<{ data: Target }>(`/api/v1/org/targets/${editing.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFromForm(form, { includeStatus: true })),
        });
        toastSuccess(t("employeeUpdated"));
      } else {
        const res = await api<{
          data: Target;
          meta?: { auto_assigned_instance_count?: number };
        }>("/api/v1/org/targets", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadFromForm(form)),
        });
        const autoCount = res.meta?.auto_assigned_instance_count ?? 0;
        toastSuccess(
          autoCount > 0
            ? `Employee created. Auto-assigned ${autoCount} checklist instance${autoCount === 1 ? "" : "s"}.`
            : t("employeeCreated"),
        );
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyTargetForm());
      setTargetsPage(1);
      await afterMutation(1);
    } catch (err) {
      toastError(err instanceof Error ? err.message : editing ? tCommon("updateFailed") : tCommon("createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function archiveTarget(target: Target) {
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/targets/${target.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      toastSuccess(t("employeeArchived"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("archiveFailed"));
      throw err;
    }
  }

  async function reactivateTarget(target: Target) {
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/targets/${target.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      toastInfo(t("employeeReactivated"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("reactivateFailed"));
    }
  }

  async function deleteTarget(target: Target) {
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/targets/${target.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess(t("employeeDeleted"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
      throw err;
    }
  }

  const columns: Array<DataTableColumn<Target>> = [
    {
      id: "avatar",
      header: tCommon("photo"),
      filter: "none",
      enableSorting: false,
      sticky: true,
      cell: (target) => (
        <Avatar
          src={target.avatar_url}
          name={[target.first_name, target.last_name].filter(Boolean).join(" ")}
          email={target.email}
          size="sm"
        />
      ),
    },
    {
      id: "email",
      header: tCommon("email"),
      accessorKey: "email",
      cell: (target) => target.email,
    },
    {
      id: "first_name",
      header: tCommon("firstName"),
      accessorKey: "first_name",
      cell: (target) => target.first_name || "—",
    },
    {
      id: "last_name",
      header: tCommon("lastName"),
      accessorKey: "last_name",
      cell: (target) => target.last_name || "—",
    },
    {
      id: "employee_number",
      header: tCommon("employeeNumber"),
      accessorKey: "employee_number",
      cell: (target) => target.employee_number || "—",
    },
    {
      id: "job_title",
      header: tCommon("titleLabel"),
      accessorKey: "job_title",
      cell: (target) => target.job_title || "—",
    },
    {
      id: "department",
      header: tCommon("department"),
      accessorKey: "department",
      cell: (target) => target.department || "—",
    },
    {
      id: "manager",
      header: tCommon("manager"),
      filterValue: (target) => managerLabel(target),
      cell: (target) => managerLabel(target) || "—",
    },
    {
      id: "phone",
      header: tCommon("phone"),
      accessorKey: "phone",
      cell: (target) => target.phone || "—",
    },
    {
      id: "location",
      header: tCommon("location"),
      accessorKey: "location",
      cell: (target) => target.location || "—",
    },
    {
      id: "employment_type",
      header: tCommon("type"),
      filter: "select",
      filterOptions: EMPLOYMENT_TYPE_OPTIONS,
      accessorKey: "employment_type",
      cell: (target) => target.employment_type || "—",
    },
    {
      id: "hire_date",
      header: tCommon("hireDate"),
      filterValue: (target) => formatDateCell(target.hire_date),
      cell: (target) => formatDateCell(target.hire_date) || "—",
    },
    {
      id: "preferred_language",
      header: tCommon("language"),
      accessorKey: "preferred_language",
      cell: (target) => languageLabel(target.preferred_language),
    },
    {
      id: "timezone",
      header: tCommon("timezone"),
      accessorKey: "timezone",
      cell: (target) => target.timezone || "—",
    },
    {
      id: "external_id",
      header: tCommon("externalId"),
      accessorKey: "external_id",
      cell: (target) => target.external_id || "—",
    },
    {
      id: "status",
      header: tCommon("status"),
      filter: "select",
      filterOptions: statusOptions,
      accessorKey: "status",
      cell: (target) => target.status || tCommon("emDash"),
    },
    {
      id: "risk_score",
      header: tCommon("risk"),
      filterValue: (target) => target.risk_score ?? 0,
      cell: (target) => target.risk_score ?? 0,
    },
    {
      id: "risk_tier",
      header: tCommon("riskTier"),
      filter: "select",
      filterOptions: RISK_TIER_OPTIONS,
      accessorKey: "risk_tier",
      cell: (target) => target.risk_tier || tCommon("emDash"),
    },
    {
      id: "risk_source",
      header: tCommon("riskSource"),
      accessorKey: "risk_source",
      cell: (target) => target.risk_source || tCommon("emDash"),
    },
    {
      id: "risk_updated_at",
      header: tCommon("riskUpdated"),
      filterValue: (target) => formatDateTimeCell(target.risk_updated_at),
      cell: (target) => formatDateTimeCell(target.risk_updated_at) || tCommon("emDash"),
    },
    {
      id: "last_training_completed_at",
      header: tCommon("lastTraining"),
      filterValue: (target) => formatDateTimeCell(target.last_training_completed_at),
      cell: (target) =>
        formatDateTimeCell(target.last_training_completed_at) || tCommon("emDash"),
    },
    {
      id: "notification_opt_out",
      header: tCommon("optOut"),
      filter: "select",
      filterOptions: [
        { label: tCommon("yes"), value: "yes" },
        { label: tCommon("no"), value: "no" },
      ],
      filterValue: (target) => (target.notification_opt_out ? "yes" : "no"),
      cell: (target) => (target.notification_opt_out ? tCommon("yes") : tCommon("no")),
    },
    {
      id: "joined_via",
      header: tCommon("joinedVia"),
      accessorKey: "joined_via",
      cell: (target) => target.joined_via || tCommon("emDash"),
    },
    {
      id: "user_id",
      header: tCommon("userId"),
      filterValue: (target) => (target.user_id != null ? String(target.user_id) : ""),
      cell: (target) => (target.user_id != null ? target.user_id : tCommon("emDash")),
    },
    {
      id: "groups",
      header: tCommon("groups"),
      filterValue: (target) => groupsLabel(target),
      cell: (target) => groupsLabel(target) || tCommon("emDash"),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (target) => (
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/org/targets/${target.id}`} size="compact" variant="outline">
            {tCommon("openAction")}
          </LinkButton>
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => openEditModal(target)}
          >
            {tCommon("edit")}
          </Button>
          {target.status === "inactive" ? (
            <Button
              type="button"
              variant="outline"
              size="compact"
              onClick={() => void reactivateTarget(target)}
            >
              {tCommon("reactivate")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="compact"
              onClick={() => setPendingArchive(target)}
            >
              {tCommon("archive")}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setPendingDeleteTarget(target)}
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 overflow-x-clip px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={statusLabel ?? t("description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => setImportWizardOpen(true)}>
              {t("importEmployees")}
            </Button>
            <Button type="button" variant="secondary" onClick={openCreateModal}>
              {t("addEmployee")}
            </Button>
          </div>
        }
      />
      
      
      <section className="mt-10">
        <h2 className="text-xl font-medium text-[var(--foreground)]">{t("title")}</h2>
        <DataTable
          className="mt-4"
          mode="server"
          caption={t("title")}
          columns={columns}
          rows={targets}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noEmployeesYet")}
          emptyDescription={t("noEmployeesHint")}
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
        title={editing ? t("editEmployee") : t("addEmployee")}
        description={
          editing ? t("editEmployeeDescription") : t("createEmployeeDescription")
        }
        dismissible={!saving}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              form="target-form"
              disabled={saving || !form.email.trim() || !form.timezone.trim()}
            >
              {saving
                ? tCommon("saving")
                : editing
                  ? tCommon("save")
                  : t("addEmployee")}
            </Button>
          </>
        }
      >
        <form id="target-form" onSubmit={(e) => void saveTarget(e)} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {editing ? (
            <div className="space-y-1">
              <Label>{tCommon("photo")}</Label>
              <AvatarUploader
                name={[form.first_name, form.last_name].filter(Boolean).join(" ")}
                email={form.email}
                avatarUrl={editing.avatar_url}
                endpoint={`/api/v1/org/targets/${editing.id}/avatar`}
                withTenant
                size="md"
                onChanged={(url) => {
                  setEditing((prev) => (prev ? { ...prev, avatar_url: url } : prev));
                  setTargets((rows) =>
                    rows.map((row) =>
                      row.id === editing.id ? { ...row, avatar_url: url } : row,
                    ),
                  );
                  setLiveTargets((rows) =>
                    rows
                      ? rows.map((row) =>
                          row.id === editing.id ? { ...row, avatar_url: url } : row,
                        )
                      : rows,
                  );
                }}
              />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="target-email">{tCommon("email")}</Label>
            <Input
              id="target-email"
              type="email"
              value={form.email}
              onChange={(e) => patchForm("email", e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-first-name">{tCommon("firstName")}</Label>
              <Input
                id="target-first-name"
                value={form.first_name}
                onChange={(e) => patchForm("first_name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-last-name">{tCommon("lastName")}</Label>
              <Input
                id="target-last-name"
                value={form.last_name}
                onChange={(e) => patchForm("last_name", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-job-title">{tCommon("titleLabel")}</Label>
              <Input
                id="target-job-title"
                value={form.job_title}
                onChange={(e) => patchForm("job_title", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-department">{tCommon("department")}</Label>
              <Select
                id="target-department"
                value={form.department_id}
                onChange={(e) => patchForm("department_id", e.target.value)}
              >
                <option value="">{t("noDepartment")}</option>
                {departments.map((department) => (
                  <option key={department.id} value={String(department.id)}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-manager">{tCommon("manager")}</Label>
              <Select
                id="target-manager"
                value={form.manager_target_id}
                onChange={(e) => patchForm("manager_target_id", e.target.value)}
              >
                <option value="">{t("noManager")}</option>
                {managerOptions
                  .filter((row) => !editing || row.id !== editing.id)
                  .map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {[row.first_name, row.last_name].filter(Boolean).join(" ") || row.email} ({row.email})
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-employment-type">{t("employmentType")}</Label>
              <Select
                id="target-employment-type"
                value={form.employment_type}
                onChange={(e) => patchForm("employment_type", e.target.value)}
              >
                <option value="">{t("notSet")}</option>
                {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-hire-date">{tCommon("hireDate")}</Label>
              <Input
                id="target-hire-date"
                type="date"
                value={form.hire_date}
                onChange={(e) => patchForm("hire_date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-employee-number">{tCommon("employeeNumber")}</Label>
              <Input
                id="target-employee-number"
                value={form.employee_number}
                onChange={(e) => patchForm("employee_number", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-phone">{tCommon("phone")}</Label>
              <Input
                id="target-phone"
                value={form.phone}
                onChange={(e) => patchForm("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-location">{tCommon("location")}</Label>
              <LocationSelect
                id="target-location"
                value={form.location}
                onChange={(next) => patchForm("location", next)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-language">{t("preferredLanguage")}</Label>
              <Select
                id="target-language"
                value={form.preferred_language}
                onChange={(e) => patchForm("preferred_language", e.target.value)}
              >
                <option value="">{t("notSet")}</option>
                {PREFERRED_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="target-timezone">{tCommon("timezone")}</Label>
              <TimezoneSelect
                id="target-timezone"
                value={form.timezone}
                onChange={(e) => patchForm("timezone", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="target-external-id">{tCommon("externalId")}</Label>
              <Input
                id="target-external-id"
                value={form.external_id}
                onChange={(e) => patchForm("external_id", e.target.value)}
              />
            </div>
            {editing ? (
              <div className="space-y-1">
                <Label htmlFor="target-status">{tCommon("status")}</Label>
                <Select
                  id="target-status"
                  value={form.status}
                  onChange={(e) => patchForm("status", e.target.value)}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.notification_opt_out}
              onChange={(e) => patchForm("notification_opt_out", e.target.checked)}
            />
            {t("optOutCampaignNotifications")}
          </label>
        </form>
      </Dialog>

      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        onImported={async (summary) => {
          toastInfo(summary);
          setTargetsPage(1);
          await afterMutation(1);
        }}
      />

      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArchive(null);
        }}
        title={t("archiveEmployee")}
        description={t("archiveConfirm", { email: pendingArchive?.email ?? "" })}
        confirmLabel={tCommon("archive")}
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
        title={t("deleteEmployee")}
        description={t("deleteConfirm", { email: pendingDeleteTarget?.email ?? "" })}
        confirmLabel={tCommon("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteTarget) return;
          await deleteTarget(pendingDeleteTarget);
        }}
      />
    </div>
  );
}
