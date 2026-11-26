"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
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
import { toastError } from "@/lib/toast";
import { CreateRoleDialog } from "./create-role-dialog";
import { EditRolePermissionsDialog } from "./edit-role-permissions-dialog";
import type { OrgRole } from "./role-types";

type RolesPayload = {
  data: OrgRole[];
  permissions?: string[];
};

/** Built-in owner role: its grants are managed by the system, not edited here. */
const LOCKED_ROLE_NAME = "org_admin";

export function RolesClient() {
  const t = useTranslations("org.roles");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "roles") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [liveRoles, setLiveRoles] = useState<OrgRole[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const applyLiveSlice = useCallback(
    (
      items: OrgRole[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((role) =>
        matchesCells(q, columnFilters, {
          name: role.name,
          permissions: role.permissions.join(" "),
        }),
      );
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setRoles(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: RolesPayload) => {
    setLiveRoles(Array.isArray(payload.data) ? payload.data : []);
    if (Array.isArray(payload.permissions)) {
      setCatalog(payload.permissions);
    }
  }, []);

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const t = resolveTenant();
      const me = await fetchSessionUser();
      setSession(me);
      if (!me) {
        return;
      }
      const [roleList, permissionList] = await Promise.all([
        api(`/api/v1/org/roles?${paginationQuery(nextPage, nextPerPage, nextFilters)}`, { tenant: t }),
        api<{ data: string[] }>("/api/v1/org/permissions", { tenant: t }),
      ]);
      const parsed = parsePaginatedResponse<OrgRole>(roleList, nextPerPage);
      setRoles(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
      setCatalog(permissionList.data ?? []);
    },
    [],
  );

  const { status } = useLiveTopic<RolesPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }
    if (liveRoles !== null) {
      applyLiveSlice(
        liveRoles,
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
    liveRoles,
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

  function updateRolePermissions(roleId: number, permissions: string[]) {
    setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, permissions } : r)));
    setLiveRoles((prev) =>
      prev ? prev.map((r) => (r.id === roleId ? { ...r, permissions } : r)) : prev,
    );
  }

  async function afterMutation() {
    if (liveRoles === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  async function onRoleCreated() {
    setCreateOpen(false);
    await afterMutation();
  }

  async function onPermissionsSaved(roleId: number, permissions: string[]) {
    setEditingRole(null);
    updateRolePermissions(roleId, permissions);
    await afterMutation();
  }

  const columns: Array<DataTableColumn<OrgRole>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (role) => role.name,
    },
    {
      id: "permissions",
      header: tCommon("permissions"),
      filter: "none",
      filterValue: (role) => role.permissions.join(" "),
      enableSorting: false,
      cell: (role) => t("permissionsSelected", { count: role.permissions.length }),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (role) => (
        <Button type="button" variant="outline" size="compact" onClick={() => setEditingRole(role)}>
          {role.name === LOCKED_ROLE_NAME ? t("viewPermissions") : t("editPermissions")}
        </Button>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <PageHeader
          title={t("title")}
          description={t("description")}
        />
        <EmptyState
          title={t("signInRequired")}
          action={
            <Link
              href="/login?next=%2Forg%2Froles"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)]"
            >
              {tCommon("signIn")}
            </Link>
          }
        />
      </div>
    );
  }

  if (!hasPermission(session, "org.roles.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <EmptyState title={t("noPermission")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={
          statusLabel ? `${t("description")} · ${statusLabel}` : t("description")
        }
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            {t("createRole")}
          </Button>
        }
      />

      <DataTable
        className="mt-8"
        mode="server"
        caption={t("rolesCaption")}
        columns={columns}
        rows={roles}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle={t("noRolesYet")}
        emptyDescription={t("noRolesHint")}
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

      {createOpen ? (
        <CreateRoleDialog
          catalog={catalog}
          onClose={() => setCreateOpen(false)}
          onCreated={onRoleCreated}
        />
      ) : null}

      {editingRole ? (
        <EditRolePermissionsDialog
          role={editingRole}
          catalog={catalog}
          readOnly={editingRole.name === LOCKED_ROLE_NAME}
          onClose={() => setEditingRole(null)}
          onSaved={onPermissionsSaved}
        />
      ) : null}
    </div>
  );
}
