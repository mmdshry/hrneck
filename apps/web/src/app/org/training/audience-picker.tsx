"use client";

import type { KeyboardEvent } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Label } from "@/components/ui/label";

export type AudienceTarget = {
  id: number;
  email: string;
  first_name?: string | null;
};

export type AudienceGroup = {
  id: number;
  name: string;
  targets_count?: number;
};

type AudiencePickerProps = {
  targets: AudienceTarget[];
  groups: AudienceGroup[];
  selectedTargetIds: number[];
  selectedGroupIds: number[];
  onChangeTargets: (ids: number[]) => void;
  onChangeGroups: (ids: number[]) => void;
};

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function preventFormSubmitOnEnter(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Enter") return;
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
    event.preventDefault();
  }
}

export function AudiencePicker({
  targets,
  groups,
  selectedTargetIds,
  selectedGroupIds,
  onChangeTargets,
  onChangeGroups,
}: AudiencePickerProps) {
  const targetColumns: Array<DataTableColumn<AudienceTarget>> = [
    {
      id: "selected",
      header: "Select",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      className: "w-12",
      cell: (target) => (
        <input
          type="checkbox"
          aria-label={`Select ${target.email}`}
          checked={selectedTargetIds.includes(target.id)}
          onChange={() => onChangeTargets(toggleId(selectedTargetIds, target.id))}
        />
      ),
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      sticky: true,
      cell: (target) => target.email,
    },
    {
      id: "first_name",
      header: "First name",
      accessorKey: "first_name",
      cell: (target) => target.first_name || "—",
    },
  ];

  const groupColumns: Array<DataTableColumn<AudienceGroup>> = [
    {
      id: "selected",
      header: "Select",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      className: "w-12",
      cell: (group) => (
        <input
          type="checkbox"
          aria-label={`Select ${group.name}`}
          checked={selectedGroupIds.includes(group.id)}
          onChange={() => onChangeGroups(toggleId(selectedGroupIds, group.id))}
        />
      ),
    },
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (group) => group.name,
    },
    {
      id: "targets_count",
      header: "Targets",
      accessorKey: "targets_count",
      cell: (group) =>
        typeof group.targets_count === "number" ? group.targets_count : "—",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2" onKeyDown={preventFormSubmitOnEnter}>
      <div className="space-y-2">
        <Label className="text-[var(--muted-foreground)]">Targets</Label>
        <DataTable
          mode="client"
          caption="Targets"
          columns={targetColumns}
          rows={targets}
          getRowId={(row) => row.id}
          emptyTitle="No targets"
          toolbarExtra={
            <button
              type="button"
              className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
              onClick={() =>
                onChangeTargets(
                  selectedTargetIds.length === targets.length ? [] : targets.map((t) => t.id),
                )
              }
            >
              {selectedTargetIds.length === targets.length ? "Clear" : "Select all"}
            </button>
          }
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[var(--muted-foreground)]">Groups</Label>
        <DataTable
          mode="client"
          caption="Groups"
          columns={groupColumns}
          rows={groups}
          getRowId={(row) => row.id}
          emptyTitle="No groups"
          toolbarExtra={
            <button
              type="button"
              className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
              onClick={() =>
                onChangeGroups(
                  selectedGroupIds.length === groups.length ? [] : groups.map((g) => g.id),
                )
              }
            >
              {selectedGroupIds.length === groups.length && groups.length > 0
                ? "Clear"
                : "Select all"}
            </button>
          }
        />
      </div>
    </div>
  );
}
