"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
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
import { toastError, toastSuccess } from "@/lib/toast";

type OrgRole = {
  id: number;
  name: string;
  permissions: string[];
};

type RolesPayload = {
  data: OrgRole[];
  permissions?: string[];
};

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
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
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

  const { status, error: liveError } = useLiveTopic<RolesPayload>({
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

  const statusLabel = liveStatusLabel(status);

  function togglePermission(permission: string) {
    setSelected((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  }

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

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    
    try {
      await ensureCsrf();
      await api("/api/v1/org/roles", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: selected }),
      });
      setName("");
      setSelected([]);
      toastSuccess(t("roleCreated"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    }
  }

  async function saveRole(role: OrgRole, permissions: string[]) {
    
    try {
      await ensureCsrf();
      await api(`/api/v1/org/roles/${role.id}`, {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      toastSuccess(`Updated ${role.name}.`);
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
    }
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
      cell: (role) => (
        <details>
          <summary className="cursor-pointer text-sm">
            {role.permissions.length} selected
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {catalog.map((permission) => {
              const checked = role.permissions.includes(permission);
              return (
                <label key={`${role.id}-${permission}`} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? role.permissions.filter((p) => p !== permission)
                        : [...role.permissions, permission];
                      updateRolePermissions(role.id, next);
                    }}
                  />
                  {permission}
                </label>
              );
            })}
          </div>
        </details>
      ),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (role) => (
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => void saveRole(role, role.permissions)}
        >
          Save permissions
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
          title="Sign in required. Use Sign in in the sidebar."
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
        <EmptyState title={"You do not have permission to manage roles."} />
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
      />
      
      

      <form onSubmit={onCreate} className="mt-8 space-y-3 rounded-2xl border border-[var(--border)] p-4">
        <p className="text-sm font-medium">{t("createRole")}</p>
        <div className="space-y-1">
          <Label htmlFor="role-name">{tCommon("name")}</Label>
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm text-[var(--muted-foreground)]">Permissions</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(permission)}
                  onChange={() => togglePermission(permission)}
                />
                {permission}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit">{t("createRole")}</Button>
      </form>

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
    </div>
  );
}
