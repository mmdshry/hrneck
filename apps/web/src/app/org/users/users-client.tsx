"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PromptDialog } from "@/components/ui/prompt-dialog";
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
import { notifyResult, toastError, toastSuccess } from "@/lib/toast";

type OrgUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

type OrgRole = {
  id: number;
  name: string;
  permissions: string[];
};

type UsersPayload = {
  data: OrgUser[];
  roles?: OrgRole[];
};

function userCells(user: OrgUser): Record<string, string> {
  return {
    name: user.name,
    email: user.email,
    role: (user.roles ?? []).join(" "),
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

export function UsersClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "users") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [liveUsers, setLiveUsers] = useState<OrgUser[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState("org_admin");
  const [renameTarget, setRenameTarget] = useState<OrgUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgUser | null>(null);
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
      items: OrgUser[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((user) => matchesCells(q, columnFilters, userCells(user)));
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setUsers(sliced.data);
      setMeta(sliced.meta);
      setPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: UsersPayload) => {
    setLiveUsers(Array.isArray(payload.data) ? payload.data : []);
    if (Array.isArray(payload.roles)) {
      setRoles(payload.roles);
      setRoleName((current) => {
        if (payload.roles!.some((r) => r.name === current)) return current;
        return payload.roles![0]?.name ?? current;
      });
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
      const canManageRoles = hasPermission(me, "org.roles.manage");
      const [userList, roleList] = await Promise.all([
        api(`/api/v1/org/users?${paginationQuery(nextPage, nextPerPage, nextFilters)}`, { tenant: t }),
        canManageRoles
          ? apiOptional<{ data: OrgRole[] }>("/api/v1/org/roles?per_page=100", { tenant: t })
          : Promise.resolve(null),
      ]);
      const parsed = parsePaginatedResponse<OrgUser>(userList, nextPerPage);
      setUsers(parsed.data);
      setMeta(parsed.meta);
      setPage(parsed.meta.current_page);
      if (roleList) {
        const roleParsed = parsePaginatedResponse<OrgRole>(roleList, 100);
        const nextRoles = roleParsed.data.length ? roleParsed.data : (roleList.data ?? []);
        setRoles(nextRoles);
        setRoleName((current) => {
          if (nextRoles.some((r) => r.name === current)) return current;
          return nextRoles[0]?.name ?? current;
        });
      } else {
        setRoles([]);
      }
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<UsersPayload>({
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
    if (liveUsers !== null) {
      applyLiveSlice(
        liveUsers,
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
        toastError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [
    liveUsers,
    page,
    perPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function afterMutation() {
    if (liveUsers === null) {
      await refreshFromApi(page, perPage, filters);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      await api("/api/v1/org/users", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, roles: [roleName] }),
      });
      setName("");
      setEmail("");
      setPassword("");
      toastSuccess("User created.");
      await afterMutation();
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function makeAdmin(userId: number) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/users/${userId}/roles`, {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: ["org_admin"] }),
      });
      toastSuccess("User promoted to org_admin.");
      await afterMutation();
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function syncRoles(userId: number, nextRole: string) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/users/${userId}/roles`, {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: [nextRole] }),
      });
      toastSuccess("Roles updated.");
      await afterMutation();
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function renameUser(user: OrgUser, nextName: string) {
    if (nextName === user.name) return;
    try {
      await ensureCsrf();
      await api(`/api/v1/org/users/${user.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      toastSuccess("User updated.");
      await afterMutation();
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Update failed");
      throw err;
    }
  }

  async function deleteUser(user: OrgUser) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/users/${user.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess("User deleted.");
      await afterMutation();
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  const columns: Array<DataTableColumn<OrgUser>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (user) => user.name,
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      cell: (user) => user.email,
    },
    {
      id: "role",
      header: "Role",
      filter: "select",
      filterOptions: roles.map((role) => ({ label: role.name, value: role.name })),
      filterValue: (user) => (user.roles ?? []).join(" "),
      enableSorting: false,
      cell: (user) => (
        <Select
          aria-label={`Role for ${user.email}`}
          value={user.roles?.[0] ?? roles[0]?.name ?? "org_admin"}
          onChange={(e) => void syncRoles(user.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
        >
          {roles.map((role) => (
            <option key={role.id} value={role.name}>
              {role.name}
            </option>
          ))}
        </Select>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (user) => (
        <div className="flex flex-wrap items-center gap-2">
          {!user.roles?.includes("org_admin") ? (
            <Button type="button" variant="secondary" onClick={() => void makeAdmin(user.id)}>
              Make admin
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setRenameTarget(user)}>
            Edit
          </Button>
          {session?.id !== user.id ? (
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(user)}>
              Delete
            </Button>
          ) : null}
        </div>
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
          title="Organization users"
          description="Invite operators and assign organization roles. Employees stay on Employees and Groups."
        />
        <Alert className="mt-4">
          Sign in required. Use Sign in in the sidebar.
        </Alert>
        <Link
          href="/login?next=%2Forg%2Fusers"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!hasPermission(session, "org.users.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <Alert variant="destructive">You do not have permission to manage users.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Organization users"
        description={
          statusLabel
            ? `Invite operators and assign organization roles. Employees stay on Employees and Groups. · ${statusLabel}`
            : "Invite operators and assign organization roles. Employees stay on Employees and Groups."
        }
      />
      {liveError ? (
        <Alert className="mt-4" variant="destructive">
          {liveError}
        </Alert>
      ) : null}

      <form onSubmit={onCreate} className="mt-8 space-y-3 rounded-2xl border border-[var(--border)] p-4">
        <p className="text-sm font-medium">Add user</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="org-user-name">Name</Label>
            <Input id="org-user-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-user-email">Email</Label>
            <Input
              id="org-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-user-password">Password</Label>
            <Input
              id="org-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-user-role">Role</Label>
            <Select
              id="org-user-role"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit">Create user</Button>
      </form>

      <DataTable
        className="mt-8"
        mode="server"
        caption="Organization users"
        columns={columns}
        rows={users}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle="No users yet."
        emptyDescription="Create an operator to assign an organization role."
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

      <PromptDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Update display name"
        label="Display name"
        defaultValue={renameTarget?.name ?? ""}
        confirmLabel="Save"
        onSubmit={async (value) => {
          if (!renameTarget) return;
          await renameUser(renameTarget, value);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete user"
        description={`Delete ${deleteTarget?.email}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteUser(deleteTarget);
        }}
      />
    </div>
  );
}
