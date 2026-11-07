"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
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

export function UsersClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
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

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const [userList, roleList] = await Promise.all([
      api(`/api/v1/org/users?${paginationQuery(nextPage, nextPerPage)}`, { tenant }),
      api<{ data: OrgRole[] }>("/api/v1/org/roles?per_page=100", { tenant }),
    ]);
    const parsed = parsePaginatedResponse<OrgUser>(userList, nextPerPage);
    setUsers(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
    const roleParsed = parsePaginatedResponse<OrgRole>(roleList, 100);
    setRoles(roleParsed.data.length ? roleParsed.data : (roleList.data ?? []));
    if (roleParsed.data[0] && !roleParsed.data.some((r) => r.name === roleName)) {
      setRoleName(roleParsed.data[0].name);
    }
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

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
      await refresh();
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
      await refresh();
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
      await refresh();
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
      await refresh();
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
      await refresh();
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <PageHeader
          title="Organization users"
          description="Invite operators and assign organization roles. Employees stay on Targets & Groups."
        />
        <Alert className="mt-4">
          Sign in required. Use Sign in in the sidebar (admin@itneck.test).
        </Alert>
        <Link
          href="/login?next=%2Forg%2Fusers"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!hasPermission(session, "org.users.manage")) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Alert variant="destructive">You do not have permission to manage users.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Organization users"
        description="Invite operators and assign organization roles. Employees stay on Targets & Groups."
      />

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

      <ul className="mt-8 space-y-3">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-[var(--muted-foreground)]">{user.email}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {(user.roles ?? []).join(", ") || "No roles"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={`Role for ${user.email}`}
                value={user.roles?.[0] ?? roles[0]?.name ?? "org_admin"}
                onChange={(e) => void syncRoles(user.id, e.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </Select>
              {!user.roles?.includes("org_admin") ? (
                <Button type="button" variant="secondary" onClick={() => void makeAdmin(user.id)}>
                  Make admin
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setRenameTarget(user)}>
                Edit
              </Button>
              {session.id !== user.id ? (
                <Button type="button" variant="outline" onClick={() => setDeleteTarget(user)}>
                  Delete
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Pagination
        className="mt-4"
        page={page}
        perPage={perPage}
        total={meta.total}
        onPageChange={setPage}
        onPerPageChange={(size) => {
          setPerPage(size);
          setPage(1);
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
