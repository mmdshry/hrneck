"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastSuccess, toastError, toastInfo } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select } from "@/components/ui/select";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { useOrgTimezone } from "@/hooks/use-org-timezone";
import { formatDateTimeCompact } from "@/lib/format-datetime";
import { api, apiOptional, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { roleChoicesFor } from "@/lib/org-role-choices";
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
import { hasAnyPermission, hasPermission, type SessionUser } from "@/lib/session";
import { matchesCells } from "@/lib/table-filter";
import { resolveTenant } from "@/lib/tenant";
import { ImportWizardDialog } from "./import/import-wizard-dialog";
import { SetEmployeePasswordDialog } from "./set-employee-password-dialog";
import {
  useEmployeeStatusOptions,
  useEmploymentTypeOptions,
  useRiskTierOptions,
} from "./target-form-steps";
import { TargetFormWizard } from "./target-form-wizard";
import { languageLabel, type Target } from "./target-types";

type TargetsPayload = {
  data: Target[];
};

type OrgRole = {
  id: number;
  name: string;
  permissions: string[];
};

function formatDateCell(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function managerLabel(target: Target): string {
  if (!target.manager) return "";
  const name = [target.manager.first_name, target.manager.last_name].filter(Boolean).join(" ").trim();
  return name || target.manager.email || "";
}

function groupsLabel(target: Target): string {
  return target.groups?.map((group) => group.name).filter(Boolean).join(", ") ?? "";
}

function targetCells(target: Target, timeZone: string): Record<string, string> {
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
    external_id: target.external_id ?? "",
    status: target.status ?? "",
    risk_score: String(target.risk_score ?? 0),
    risk_tier: target.risk_tier ?? "",
    risk_source: target.risk_source ?? "",
    risk_updated_at: formatDateTimeCompact(target.risk_updated_at, timeZone),
    last_training_completed_at: formatDateTimeCompact(target.last_training_completed_at, timeZone),
    notification_opt_out: target.notification_opt_out ? "yes" : "no",
    joined_via: target.joined_via ?? "",
    user_id: target.user_id != null ? String(target.user_id) : "",
    role: (target.account_roles ?? []).join(" "),
    groups: groupsLabel(target),
  };
}

export function TargetsClient() {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const orgTimeZone = useOrgTimezone();
  const statusOptions = useEmployeeStatusOptions();
  const employmentTypeOptions = useEmploymentTypeOptions();
  const riskTierOptions = useRiskTierOptions();
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "targets") : null;
  const [targets, setTargets] = useState<Target[]>([]);
  const [liveTargets, setLiveTargets] = useState<Target[] | null>(null);
  const [targetsMeta, setTargetsMeta] = useState<PaginationMeta>(emptyMeta());
  const [targetsPage, setTargetsPage] = useState(1);
  const [targetsPerPage, setTargetsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [pendingArchive, setPendingArchive] = useState<Target | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<Target | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Target | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Target | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [roles, setRoles] = useState<OrgRole[]>([]);
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
        matchesCells(q, columnFilters, targetCells(target, orgTimeZone)),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setTargets(sliced.data);
      setTargetsMeta(sliced.meta);
      setTargetsPage(sliced.meta.current_page);
    },
    [orgTimeZone],
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
    let cancelled = false;
    void (async () => {
      const me = await fetchSessionUser().catch(() => null);
      if (cancelled) return;
      setSession(me);
      setSessionReady(true);
      if (me && hasPermission(me, "org.roles.manage")) {
        const res = await apiOptional<{ data: OrgRole[] }>("/api/v1/org/roles?per_page=100", {
          tenant: resolveTenant(),
        }).catch(() => null);
        if (cancelled || !res) return;
        const parsed = parsePaginatedResponse<OrgRole>(res, 100);
        setRoles(parsed.data.length ? parsed.data : (res.data ?? []));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  const canManageTargets = hasPermission(session, "org.targets.manage");
  const canViewTargets = hasAnyPermission(session, ["org.targets.view", "org.targets.manage"]);
  const canManageUsers = hasPermission(session, "org.users.manage");
  const canGrantOrgAdmin = session?.roles.includes("org_admin") ?? false;
  /** Roles the viewer may assign. Only org admins may grant org_admin; the API enforces the same rule. */
  const roleCatalog = useMemo(
    () => (canGrantOrgAdmin ? roles : roles.filter((role) => role.name !== "org_admin")),
    [roles, canGrantOrgAdmin],
  );

  async function afterMutation(nextPage = targetsPage) {
    if (liveTargets === null) {
      await refreshFromApi(nextPage, targetsPerPage, filters);
    }
  }

  function openCreateModal() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEditModal(target: Target) {
    setEditing(target);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function updateTargetAvatar(targetId: number, url: string | null) {
    setTargets((rows) =>
      rows.map((row) => (row.id === targetId ? { ...row, avatar_url: url } : row)),
    );
    setLiveTargets((rows) =>
      rows
        ? rows.map((row) => (row.id === targetId ? { ...row, avatar_url: url } : row))
        : rows,
    );
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

  async function syncTargetRole(target: Target, nextRole: string) {
    if (target.user_id == null) return;
    try {
      await ensureCsrf();
      await api(`/api/v1/org/users/${target.user_id}/roles`, {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: [nextRole] }),
      });
      toastSuccess(t("rolesUpdated"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
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
      id: "role",
      header: tCommon("role"),
      filter: "select",
      filterOptions: roleCatalog.map((role) => ({ label: role.name, value: role.name })),
      filterValue: (target) => (target.account_roles ?? []).join(" "),
      enableSorting: false,
      cell: (target) => {
        if (target.user_id == null) {
          return <span className="text-[var(--muted-foreground)]">{tCommon("emDash")}</span>;
        }
        const choice = roleChoicesFor(target.account_roles ?? [], roleCatalog, t("noRole"));
        return (
          <Select
            aria-label={t("roleFor", { email: target.email })}
            value={choice.value}
            disabled={!canManageUsers}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "" || next === choice.value) return;
              void syncTargetRole(target, next);
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {choice.options.map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );
      },
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
      filterOptions: employmentTypeOptions,
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
      filterOptions: riskTierOptions,
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
      filterValue: (target) => formatDateTimeCompact(target.risk_updated_at, orgTimeZone),
      cell: (target) =>
        formatDateTimeCompact(target.risk_updated_at, orgTimeZone) || tCommon("emDash"),
    },
    {
      id: "last_training_completed_at",
      header: tCommon("lastTraining"),
      filterValue: (target) => formatDateTimeCompact(target.last_training_completed_at, orgTimeZone),
      cell: (target) =>
        formatDateTimeCompact(target.last_training_completed_at, orgTimeZone) || tCommon("emDash"),
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
          {canViewTargets ? (
            <LinkButton href={`/org/targets/${target.id}`} size="compact" variant="outline">
              {tCommon("openAction")}
            </LinkButton>
          ) : null}
          {canManageTargets ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="compact"
                onClick={() => openEditModal(target)}
              >
                {tCommon("edit")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="compact"
                onClick={() => setPasswordTarget(target)}
              >
                {t("setPassword")}
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
            </>
          ) : null}
        </div>
      ),
    },
  ];

  if (loading || !sessionReady) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl flex-1 overflow-x-clip px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={statusLabel ?? t("description")}
        actions={
          canManageTargets ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setImportWizardOpen(true)}>
                {t("importEmployees")}
              </Button>
              <Button type="button" variant="secondary" onClick={openCreateModal}>
                {t("addEmployee")}
              </Button>
            </div>
          ) : undefined
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

      <SetEmployeePasswordDialog
        key={passwordTarget?.id ?? "closed"}
        target={passwordTarget}
        onClose={() => setPasswordTarget(null)}
      />

      {modalOpen ? (
        <TargetFormWizard
          target={editing}
          roleOptions={canManageUsers ? roleCatalog : undefined}
          onClose={closeModal}
          onSaved={async () => {
            setTargetsPage(1);
            await afterMutation(1);
          }}
          onAvatarChanged={updateTargetAvatar}
        />
      ) : null}

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
