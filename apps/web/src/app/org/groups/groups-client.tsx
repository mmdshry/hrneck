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

type Target = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

type Group = {
  id: number;
  name: string;
  targets_count?: number;
  target_ids?: number[];
};

type GroupsPayload = {
  data: Group[];
};

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid|unauthorized|rejected|denied)\b/.test(m) ||
    m.includes("load failed") ||
    m.includes("group failed")
  ) {
    return "destructive";
  }
  if (/\b(created|saved|updated|deleted)\b/.test(m) || m.includes("group created")) {
    return "success";
  }
  return "default";
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function targetLabel(target: Target): string {
  const name = [target.first_name, target.last_name].filter(Boolean).join(" ").trim();
  return name ? `${name} · ${target.email}` : target.email;
}

function groupCells(group: Group): Record<string, string> {
  return {
    name: group.name,
    targets_count: String(group.targets_count ?? group.target_ids?.length ?? 0),
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

export function GroupsClient() {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "groups") : null;
  const [groups, setGroups] = useState<Group[]>([]);
  const [liveGroups, setLiveGroups] = useState<Group[] | null>(null);
  const [groupsMeta, setGroupsMeta] = useState<PaginationMeta>(emptyMeta());
  const [groupsPage, setGroupsPage] = useState(1);
  const [groupsPerPage, setGroupsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [targets, setTargets] = useState<Target[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<Group | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const filteredTargets = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => {
      const hay = `${t.first_name ?? ""} ${t.last_name ?? ""} ${t.email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [targets, memberQuery]);

  const applyLiveSlice = useCallback(
    (
      items: Group[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((group) => matchesCells(q, columnFilters, groupCells(group)));
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setGroups(sliced.data);
      setGroupsMeta(sliced.meta);
      setGroupsPage(sliced.meta.current_page);
    },
    [],
  );

  const onPayload = useCallback((payload: GroupsPayload) => {
    setLiveGroups(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshGroupsFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const me = await fetchSessionUser();
      if (!me) {
        return;
      }
      const t = resolveTenant();
      const g = await api(`/api/v1/org/groups?${paginationQuery(nextPage, nextPerPage, nextFilters)}`, {
        tenant: t,
      });
      const groupsParsed = parsePaginatedResponse<Group>(g, nextPerPage);
      setGroups(groupsParsed.data);
      setGroupsMeta(groupsParsed.meta);
      setGroupsPage(groupsParsed.meta.current_page);
    },
    [],
  );

  const loadTargetsForPicker = useCallback(async () => {
    const t = resolveTenant();
    const res = await api(`/api/v1/org/targets?${paginationQuery(1, 500)}`, { tenant: t });
    const parsed = parsePaginatedResponse<Target>(res, 500);
    setTargets(parsed.data);
  }, []);

  const { status, error: liveError } = useLiveTopic<GroupsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        if (!me) return;
        await loadTargetsForPicker();
      } catch (err: unknown) {
        setMessage(err instanceof Error ? err.message : "Load failed");
      }
    })();
  }, [loadTargetsForPicker]);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (groupsPage !== 1) {
        setGroupsPage(1);
        return;
      }
    }
    if (liveGroups !== null) {
      applyLiveSlice(
        liveGroups,
        groupsPage,
        groupsPerPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      setLoading(false);
      return;
    }
    void refreshGroupsFromApi(groupsPage, groupsPerPage, filters)
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => setLoading(false));
  }, [
    liveGroups,
    groupsPage,
    groupsPerPage,
    filters,
    filtersKey,
    applyLiveSlice,
    refreshGroupsFromApi,
    tableQuery.debounced,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function afterMutation(nextPage = groupsPage) {
    if (liveGroups === null) {
      await refreshGroupsFromApi(nextPage, groupsPerPage, filters);
    }
  }

  function openCreateModal() {
    setEditingGroup(null);
    setGroupName("");
    setSelectedTargetIds([]);
    setMemberQuery("");
    setModalOpen(true);
  }

  function openEditModal(group: Group) {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedTargetIds(group.target_ids ?? []);
    setMemberQuery("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditingGroup(null);
    setGroupName("");
    setSelectedTargetIds([]);
    setMemberQuery("");
  }

  async function saveGroup(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await ensureCsrf();
      const t = resolveTenant();
      const payload = {
        name: groupName.trim(),
        target_ids: selectedTargetIds,
      };
      if (editingGroup) {
        await api(`/api/v1/org/groups/${editingGroup.id}`, {
          method: "PATCH",
          tenant: t,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Group updated.");
      } else {
        await api("/api/v1/org/groups", {
          method: "POST",
          tenant: t,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setMessage("Group created.");
        setGroupsPage(1);
      }
      setModalOpen(false);
      setEditingGroup(null);
      setGroupName("");
      setSelectedTargetIds([]);
      setMemberQuery("");
      await afterMutation(editingGroup ? groupsPage : 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Group failed");
    } finally {
      setSaving(false);
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
      await afterMutation();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  const columns: Array<DataTableColumn<Group>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (group) => group.name,
    },
    {
      id: "targets_count",
      header: "Members",
      filter: "none",
      filterValue: (group) => group.targets_count ?? group.target_ids?.length ?? 0,
      cell: (group) => group.targets_count ?? group.target_ids?.length ?? 0,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (group) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => openEditModal(group)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-0 px-2 py-1 text-xs"
            onClick={() => setPendingDeleteGroup(group)}
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
        title="Groups"
        description={
          statusLabel ??
          "Organize employees into audience groups for campaigns and assignments."
        }
        actions={
          <Button type="button" onClick={openCreateModal}>
            Create group
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
          caption="Groups"
          columns={columns}
          rows={groups}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle="No groups yet"
          emptyDescription="Create a group and select members from your employees."
          pagination={{
            page: groupsPage,
            perPage: groupsPerPage,
            total: groupsMeta.total,
            onPageChange: setGroupsPage,
            onPerPageChange: (size) => {
              setGroupsPerPage(size);
              setGroupsPage(1);
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
        title={editingGroup ? "Edit group" : "Create group"}
        description="Choose a name and select the employees who belong to this group."
        size="lg"
        className="max-w-2xl"
        dismissible={!saving}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="group-form" disabled={saving || !groupName.trim()}>
              {saving ? "Saving…" : editingGroup ? "Save changes" : "Create group"}
            </Button>
          </>
        }
      >
        <form id="group-form" onSubmit={(e) => void saveGroup(e)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[var(--muted-foreground)]">Members</Label>
              <button
                type="button"
                className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
                onClick={() => {
                  const visibleIds = filteredTargets.map((t) => t.id);
                  const allVisibleSelected =
                    visibleIds.length > 0 &&
                    visibleIds.every((id) => selectedTargetIds.includes(id));
                  if (allVisibleSelected) {
                    setSelectedTargetIds(
                      selectedTargetIds.filter((id) => !visibleIds.includes(id)),
                    );
                    return;
                  }
                  setSelectedTargetIds(
                    Array.from(new Set([...selectedTargetIds, ...visibleIds])),
                  );
                }}
              >
                {filteredTargets.length > 0 &&
                filteredTargets.every((t) => selectedTargetIds.includes(t.id))
                  ? "Clear"
                  : "Select all"}
              </button>
            </div>
            <Input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Search employees…"
              aria-label="Search employees"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] p-2">
              {filteredTargets.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[var(--muted-foreground)]">
                  {targets.length === 0
                    ? "No employees available. Import people on the Employees page first."
                    : "No employees match your search."}
                </p>
              ) : (
                filteredTargets.map((target) => (
                  <label
                    key={target.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTargetIds.includes(target.id)}
                      onChange={() =>
                        setSelectedTargetIds(toggleId(selectedTargetIds, target.id))
                      }
                    />
                    <span className="truncate">{targetLabel(target)}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {selectedTargetIds.length} selected
            </p>
          </div>
        </form>
      </Dialog>

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
