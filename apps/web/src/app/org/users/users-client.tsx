"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
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
import { toastError, toastSuccess } from "@/lib/toast";

type OrgUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  department_id?: number | null;
  department?: string | null;
  job_title?: string | null;
  target_department?: string | null;
  avatar_url?: string | null;
};

type OrgRole = {
  id: number;
  name: string;
  permissions: string[];
};

type DepartmentOption = {
  id: number;
  name: string;
};

type UsersPayload = {
  data: OrgUser[];
  roles?: OrgRole[];
};

function roleChoices(
  user: OrgUser,
  catalog: OrgRole[],
  noRoleLabel: string,
): { value: string; options: { value: string; label: string }[] } {
  const current = user.roles?.[0] ?? "";
  const options = catalog.map((role) => ({ value: role.name, label: role.name }));
  if (current === "") {
    options.unshift({ value: "", label: noRoleLabel });
    return { value: "", options };
  }
  if (!options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: current });
  }
  return { value: current, options };
}

function userCells(user: OrgUser): Record<string, string> {
  return {
    name: user.name,
    email: user.email,
    role: (user.roles ?? []).join(" "),
    department: user.department ?? "",
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
  const t = useTranslations("org.users");
  const tCommon = useTranslations("common");
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
  const [departmentId, setDepartmentId] = useState("");
  const [createErrors, setCreateErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const createErrorSummaryRef = useRef<HTMLDivElement | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [editTarget, setEditTarget] = useState<OrgUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [avatarTarget, setAvatarTarget] = useState<OrgUser | null>(null);
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
      const tenantSlug = resolveTenant();
      const canManageRoles = hasPermission(me, "org.roles.manage");
      const [userList, roleList, departmentList] = await Promise.all([
        api(`/api/v1/org/users?${paginationQuery(nextPage, nextPerPage, nextFilters)}`, {
          tenant: tenantSlug,
        }),
        canManageRoles
          ? apiOptional<{ data: OrgRole[] }>("/api/v1/org/roles?per_page=100", {
              tenant: tenantSlug,
            })
          : Promise.resolve(null),
        apiOptional<{ data: DepartmentOption[] }>(
          `/api/v1/org/departments?${paginationQuery(1, 500, { active_only: "1" })}`,
          { tenant: tenantSlug },
        ),
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
      if (departmentList) {
        const deptParsed = parsePaginatedResponse<DepartmentOption>(departmentList, 500);
        setDepartments(deptParsed.data.length ? deptParsed.data : (departmentList.data ?? []));
      } else {
        setDepartments([]);
      }
    },
    [],
  );

  const { status, error: liveError } = useLiveTopic<UsersPayload>({
    channel,
    onPayload,
  });

  const canManageUsers = hasPermission(session, "org.users.manage");

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    if (session && !canManageUsers) {
      toastError("You do not have permission to manage users.");
    }
  }, [session, canManageUsers]);

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
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
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
    const nextErrors: { name?: string; email?: string; password?: string } = {};
    if (!name.trim()) nextErrors.name = t("enterName");
    if (!email.trim()) nextErrors.email = t("enterEmail");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = t("enterValidEmail");
    }
    if (!password) nextErrors.password = t("enterPassword");
    else if (password.length < 8) nextErrors.password = t("passwordMin");
    setCreateErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      queueMicrotask(() => createErrorSummaryRef.current?.focus());
      return;
    }
    try {
      await ensureCsrf();
      await api("/api/v1/org/users", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          roles: [roleName],
          department_id: departmentId ? Number(departmentId) : null,
        }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setDepartmentId("");
      setCreateErrors({});
      toastSuccess(t("userCreated"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
    }
  }

  function openEdit(user: OrgUser) {
    setEditTarget(user);
    setEditName(user.name);
    setEditDepartmentId(user.department_id != null ? String(user.department_id) : "");
  }

  async function saveEdit() {
    if (!editTarget) return;
    try {
      await ensureCsrf();
      await api(`/api/v1/org/users/${editTarget.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          department_id: editDepartmentId ? Number(editDepartmentId) : null,
        }),
      });
      toastSuccess(t("userUpdated"));
      setEditTarget(null);
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
      throw err;
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
      toastSuccess(t("userPromoted"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
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
      toastSuccess(t("rolesUpdated"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
    }
  }

  async function deleteUser(user: OrgUser) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/users/${user.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      toastSuccess(t("userDeleted"));
      await afterMutation();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
      throw err;
    }
  }

  const columns: Array<DataTableColumn<OrgUser>> = [
    {
      id: "avatar",
      header: tCommon("photo"),
      filter: "none",
      enableSorting: false,
      sticky: true,
      cell: (user) => (
        <Avatar src={user.avatar_url} name={user.name} email={user.email} size="sm" />
      ),
    },
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      cell: (user) => user.name,
    },
    {
      id: "email",
      header: tCommon("email"),
      accessorKey: "email",
      cell: (user) => user.email,
    },
    {
      id: "role",
      header: tCommon("role"),
      filter: "select",
      filterOptions: roles.map((role) => ({ label: role.name, value: role.name })),
      filterValue: (user) => (user.roles ?? []).join(" "),
      enableSorting: false,
      cell: (user) => {
        const choice = roleChoices(user, roles, t("noRole"));
        return (
          <Select
            aria-label={`Role for ${user.email}`}
            value={choice.value}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "" || next === (user.roles?.[0] ?? "")) {
                return;
              }
              void syncRoles(user.id, next);
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
      id: "department",
      header: tCommon("department"),
      accessorKey: "department",
      filterValue: (user) => user.department ?? "",
      enableSorting: false,
      cell: (user) => user.department ?? "—",
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (user) => (
        <div className="flex flex-wrap items-center gap-2">
          {!user.roles?.includes("org_admin") ? (
            <Button
              type="button"
              variant="outline"
              size="compact"
              onClick={() => void makeAdmin(user.id)}
            >
              Make admin
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => openEdit(user)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setAvatarTarget(user)}
          >
            Photo
          </Button>
          {session?.id !== user.id ? (
            <Button
              type="button"
              variant="outline"
              size="compact"
              onClick={() => setDeleteTarget(user)}
            >
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
          title={t("title")}
          description={t("description")}
        />
        <EmptyState
          className="mt-4"
          title="Sign in required. Use Sign in in the sidebar."
          action={
            <Link
              href="/login?next=%2Forg%2Fusers"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)]"
            >
              {tCommon("signIn")}
            </Link>
          }
        />
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState title="You do not have permission to manage users." />
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

      <form
        onSubmit={onCreate}
        className="mt-8 space-y-3 rounded-2xl border border-[var(--border)] p-4"
        noValidate
      >
        <p className="text-sm font-medium">Add user</p>
        {Object.keys(createErrors).length > 0 ? (
          <div
            ref={createErrorSummaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-[var(--radius)] border border-[var(--destructive)]/40 bg-[var(--destructive)]/10 px-[var(--space-md)] py-[var(--space-sm)] text-sm text-[var(--destructive)] outline-none"
            aria-labelledby="org-user-error-title"
          >
            <p id="org-user-error-title" className="font-medium">
              There is a problem
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {createErrors.name ? (
                <li>
                  <a href="#org-user-name" className="underline-offset-2 hover:underline">
                    {createErrors.name}
                  </a>
                </li>
              ) : null}
              {createErrors.email ? (
                <li>
                  <a href="#org-user-email" className="underline-offset-2 hover:underline">
                    {createErrors.email}
                  </a>
                </li>
              ) : null}
              {createErrors.password ? (
                <li>
                  <a href="#org-user-password" className="underline-offset-2 hover:underline">
                    {createErrors.password}
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="org-user-name">Name</Label>
            <Input
              id="org-user-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: undefined }));
              }}
              required
              aria-invalid={createErrors.name ? true : undefined}
              aria-describedby={createErrors.name ? "org-user-name-error" : undefined}
            />
            {createErrors.name ? (
              <p id="org-user-name-error" className="text-xs text-[var(--destructive)]">
                {createErrors.name}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-user-email">Email</Label>
            <Input
              id="org-user-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (createErrors.email) setCreateErrors((prev) => ({ ...prev, email: undefined }));
              }}
              required
              aria-invalid={createErrors.email ? true : undefined}
              aria-describedby={createErrors.email ? "org-user-email-error" : undefined}
            />
            {createErrors.email ? (
              <p id="org-user-email-error" className="text-xs text-[var(--destructive)]">
                {createErrors.email}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-user-password">Password</Label>
            <Input
              id="org-user-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (createErrors.password) {
                  setCreateErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              required
              minLength={8}
              aria-invalid={createErrors.password ? true : undefined}
              aria-describedby={createErrors.password ? "org-user-password-error" : undefined}
            />
            {createErrors.password ? (
              <p id="org-user-password-error" className="text-xs text-[var(--destructive)]">
                {createErrors.password}
              </p>
            ) : null}
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
          <div className="space-y-1">
            <Label htmlFor="org-user-department">Department</Label>
            <Select
              id="org-user-department"
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
        </div>
        <Button type="submit">Create user</Button>
      </form>

      <DataTable
        className="mt-8"
        mode="server"
        caption={t("usersCaption")}
        columns={columns}
        rows={users}
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        getRowId={(row) => row.id}
        emptyTitle={t("noUsersYet")}
        emptyDescription={t("noUsersHint")}
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

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title={t("editUser")}
        description={editTarget?.email ?? undefined}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void saveEdit();
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="org-user-edit-name">Display name</Label>
            <Input
              id="org-user-edit-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="org-user-edit-department">Department</Label>
            <Select
              id="org-user-edit-department"
              value={editDepartmentId}
              onChange={(e) => setEditDepartmentId(e.target.value)}
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={String(department.id)}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={avatarTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAvatarTarget(null);
        }}
        title={t("userPhoto")}
        description={avatarTarget?.email ?? undefined}
      >
        {avatarTarget ? (
          <AvatarUploader
            name={avatarTarget.name}
            email={avatarTarget.email}
            avatarUrl={avatarTarget.avatar_url}
            endpoint={`/api/v1/org/users/${avatarTarget.id}/avatar`}
            withTenant
            size="md"
            onChanged={(url) => {
              setAvatarTarget((prev) => (prev ? { ...prev, avatar_url: url } : prev));
              setUsers((rows) =>
                rows.map((row) =>
                  row.id === avatarTarget.id ? { ...row, avatar_url: url } : row,
                ),
              );
              setLiveUsers((rows) =>
                rows
                  ? rows.map((row) =>
                      row.id === avatarTarget.id ? { ...row, avatar_url: url } : row,
                    )
                  : rows,
              );
            }}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t("deleteUser")}
        description={`Delete ${deleteTarget?.email}? This cannot be undone.`}
        confirmLabel={tCommon("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteUser(deleteTarget);
        }}
      />
    </div>
  );
}
