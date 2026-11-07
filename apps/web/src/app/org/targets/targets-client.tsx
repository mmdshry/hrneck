"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";

type Target = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  status?: string;
  risk_score?: number;
};

type Group = {
  id: number;
  name: string;
  targets_count?: number;
};

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid|unauthorized|rejected|denied)\b/.test(m) ||
    m.includes("load failed") ||
    m.includes("sync failed") ||
    m.includes("import failed") ||
    m.includes("group failed")
  ) {
    return "destructive";
  }
  if (
    /\b(synced|imported|created|saved|updated|launched|queued|generated|confirmed)\b/.test(m) ||
    m.includes("group created") ||
    m.includes("rows.")
  ) {
    return "success";
  }
  return "default";
}

export function TargetsClient() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsMeta, setGroupsMeta] = useState<PaginationMeta>(emptyMeta());
  const [targetsMeta, setTargetsMeta] = useState<PaginationMeta>(emptyMeta());
  const [targetsPage, setTargetsPage] = useState(1);
  const [targetsPerPage, setTargetsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [groupsPage, setGroupsPage] = useState(1);
  const [groupsPerPage, setGroupsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [groupName, setGroupName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Target | null>(null);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<Target | null>(null);
  const [pendingRenameGroup, setPendingRenameGroup] = useState<Group | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(
    nextTargetsPage = targetsPage,
    nextTargetsPerPage = targetsPerPage,
    nextGroupsPage = groupsPage,
    nextGroupsPerPage = groupsPerPage,
  ) {
    await ensureCsrf();
    const me = await fetchSessionUser();
    if (!me) {
      return;
    }
    const tenant = resolveTenant();
    const [t, g] = await Promise.all([
      api(`/api/v1/org/targets?${paginationQuery(nextTargetsPage, nextTargetsPerPage)}`, {
        tenant,
      }),
      api(`/api/v1/org/groups?${paginationQuery(nextGroupsPage, nextGroupsPerPage)}`, {
        tenant,
      }),
    ]);
    const targetsParsed = parsePaginatedResponse<Target>(t, nextTargetsPerPage);
    const groupsParsed = parsePaginatedResponse<Group>(g, nextGroupsPerPage);
    setTargets(targetsParsed.data);
    setTargetsMeta(targetsParsed.meta);
    setTargetsPage(targetsParsed.meta.current_page);
    setGroups(groupsParsed.data);
    setGroupsMeta(groupsParsed.meta);
    setGroupsPage(groupsParsed.meta.current_page);
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsPage, targetsPerPage, groupsPage, groupsPerPage]);

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
      await refresh(1, targetsPerPage, 1, groupsPerPage);
      setTargetsPage(1);
      setGroupsPage(1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed");
    }
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      await api("/api/v1/org/groups", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          target_ids: targets.slice(0, 5).map((t) => t.id),
        }),
      });
      setGroupName("");
      setMessage("Group created.");
      setGroupsPage(1);
      await refresh(targetsPage, targetsPerPage, 1, groupsPerPage);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Group failed");
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
      const res = await api<{ imported: number }>("/api/v1/org/targets/import", {
        method: "POST",
        tenant: resolveTenant(),
        body,
      });
      setMessage(`Imported ${res.imported} rows.`);
      setTargetsPage(1);
      await refresh(1, targetsPerPage, groupsPage, groupsPerPage);
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
      setMessage("Target archived.");
      await refresh();
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
      setMessage("Target deleted.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  async function renameGroup(group: Group, nextName: string) {
    if (nextName === group.name) return;
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/groups/${group.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      setMessage("Group updated.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
      throw err;
    }
  }

  async function deleteGroup(group: Group) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/groups/${group.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setMessage("Group deleted.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Targets & groups"
        description="Manage audience, CSV upload, and mock directory sync."
        actions={
          <Button type="button" onClick={() => void syncDirectory()}>
            Run directory sync
          </Button>
        }
      />
      {message ? (
        <Alert className="mt-4" variant={alertVariantForMessage(message)}>
          {message}
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
      <form onSubmit={createGroup} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="new-group-name" className="text-[var(--muted-foreground)]">
            New group
          </Label>
          <Input
            id="new-group-name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="secondary">
          Create group
        </Button>
      </form>
      <section className="mt-10">
        <h2 className="text-xl font-medium text-[var(--foreground)]">Groups</h2>
        {groups.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No groups yet"
            description="Create a group or run directory sync to populate audiences."
          />
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {groups.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>{g.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)]">
                    {g.targets_count ?? 0} members
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-0 px-2 py-1 text-xs"
                    onClick={() => setPendingRenameGroup(g)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-0 px-2 py-1 text-xs"
                    onClick={() => setPendingDeleteGroup(g)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          className="mt-3"
          page={groupsPage}
          perPage={groupsPerPage}
          total={groupsMeta.total}
          onPageChange={setGroupsPage}
          onPerPageChange={(size) => {
            setGroupsPerPage(size);
            setGroupsPage(1);
          }}
        />
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-medium text-[var(--foreground)]">Targets</h2>
        {targets.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No targets"
            description="Upload a CSV or run directory sync to add people."
          />
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {targets.map((target) => (
              <li
                key={target.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium">
                    {target.first_name} {target.last_name}
                  </p>
                  <p className="text-sm text-[var(--muted-foreground)]">{target.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm">Risk {target.risk_score ?? 0}</p>
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
              </li>
            ))}
          </ul>
        )}
        <Pagination
          className="mt-3"
          page={targetsPage}
          perPage={targetsPerPage}
          total={targetsMeta.total}
          onPageChange={setTargetsPage}
          onPerPageChange={(size) => {
            setTargetsPerPage(size);
            setTargetsPage(1);
          }}
        />
      </section>

      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArchive(null);
        }}
        title="Archive target"
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
        title="Delete target"
        description={`Permanently delete ${pendingDeleteTarget?.email}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteTarget) return;
          await deleteTarget(pendingDeleteTarget);
        }}
      />

      <PromptDialog
        open={pendingRenameGroup !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRenameGroup(null);
        }}
        title="Rename group"
        label="Group name"
        defaultValue={pendingRenameGroup?.name ?? ""}
        confirmLabel="Save"
        onSubmit={async (value) => {
          if (!pendingRenameGroup) return;
          await renameGroup(pendingRenameGroup, value);
        }}
      />

      <ConfirmDialog
        open={pendingDeleteGroup !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteGroup(null);
        }}
        title="Delete group"
        description={`Delete group ${pendingDeleteGroup?.name}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingDeleteGroup) return;
          await deleteGroup(pendingDeleteGroup);
        }}
      />
    </div>
  );
}
