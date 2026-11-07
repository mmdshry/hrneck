"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
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

type OrgRole = {
  id: number;
  name: string;
  permissions: string[];
};

export function RolesClient() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(nextPage = page, nextPerPage = perPage) {
    await ensureCsrf();
    const tenant = resolveTenant();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const [roleList, permissionList] = await Promise.all([
      api(`/api/v1/org/roles?${paginationQuery(nextPage, nextPerPage)}`, { tenant }),
      api<{ data: string[] }>("/api/v1/org/permissions", { tenant }),
    ]);
    const parsed = parsePaginatedResponse<OrgRole>(roleList, nextPerPage);
    setRoles(parsed.data);
    setMeta(parsed.meta);
    setPage(parsed.meta.current_page);
    setCatalog(permissionList.data ?? []);
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  function togglePermission(permission: string) {
    setSelected((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
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
      setMessage("Role created.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function saveRole(role: OrgRole, permissions: string[]) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/roles/${role.id}`, {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      setMessage(`Updated ${role.name}.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <PageHeader
          title="Roles & permissions"
          description="RBAC for organization operators. Employee categorization stays on Targets & Groups."
        />
        <Alert className="mt-4">
          Sign in required. Use Sign in in the sidebar (admin@itneck.test).
        </Alert>
        <Link
          href="/login?next=%2Forg%2Froles"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!hasPermission(session, "org.roles.manage")) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Alert variant="destructive">You do not have permission to manage roles.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Roles & permissions"
        description="RBAC for organization operators. Employee categorization stays on Targets & Groups."
      />
      {message ? (
        <Alert
          className="mt-4"
          variant={message.toLowerCase().includes("fail") ? "destructive" : "success"}
        >
          {message}
        </Alert>
      ) : null}

      <form onSubmit={onCreate} className="mt-8 space-y-3 rounded-2xl border border-[var(--border)] p-4">
        <p className="text-sm font-medium">Create role</p>
        <div className="space-y-1">
          <Label htmlFor="role-name">Name</Label>
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
        <Button type="submit">Create role</Button>
      </form>

      <ul className="mt-8 space-y-4">
        {roles.map((role) => (
          <li key={role.id} className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{role.name}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void saveRole(role, role.permissions)}
              >
                Save permissions
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                        setRoles((prev) =>
                          prev.map((r) => (r.id === role.id ? { ...r, permissions: next } : r)),
                        );
                      }}
                    />
                    {permission}
                  </label>
                );
              })}
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
    </div>
  );
}
