"use client";

import type { KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("org.training");
  const tCommon = useTranslations("common");
  const targetColumns: Array<DataTableColumn<AudienceTarget>> = [
    {
      id: "selected",
      header: tCommon("select"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      className: "w-12",
      cell: (target) => (
        <input
          type="checkbox"
          aria-label={t("pickerSelectItem", { name: target.email })}
          checked={selectedTargetIds.includes(target.id)}
          onChange={() => onChangeTargets(toggleId(selectedTargetIds, target.id))}
        />
      ),
    },
    {
      id: "email",
      header: tCommon("email"),
      accessorKey: "email",
      sticky: true,
      cell: (target) => target.email,
    },
    {
      id: "first_name",
      header: tCommon("firstName"),
      accessorKey: "first_name",
      cell: (target) => target.first_name || "—",
    },
  ];

  const groupColumns: Array<DataTableColumn<AudienceGroup>> = [
    {
      id: "selected",
      header: tCommon("select"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      className: "w-12",
      cell: (group) => (
        <input
          type="checkbox"
          aria-label={t("pickerSelectItem", { name: group.name })}
          checked={selectedGroupIds.includes(group.id)}
          onChange={() => onChangeGroups(toggleId(selectedGroupIds, group.id))}
        />
      ),
    },
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (group) => group.name,
    },
    {
      id: "targets_count",
      header: t("pickerTargets"),
      accessorKey: "targets_count",
      cell: (group) =>
        typeof group.targets_count === "number" ? group.targets_count : "—",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2" onKeyDown={preventFormSubmitOnEnter}>
      <div className="space-y-2">
        <Label className="text-[var(--muted-foreground)]">{t("pickerTargets")}</Label>
        <DataTable
          mode="client"
          caption={t("pickerTargets")}
          columns={targetColumns}
          rows={targets}
          getRowId={(row) => row.id}
          emptyTitle={t("pickerNoTargets")}
          toolbarExtra={
            <button
              type="button"
              className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
              onClick={() =>
                onChangeTargets(
                  selectedTargetIds.length === targets.length ? [] : targets.map((row) => row.id),
                )
              }
            >
              {selectedTargetIds.length === targets.length ? tCommon("clear") : tCommon("selectAll")}
            </button>
          }
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[var(--muted-foreground)]">{tCommon("groups")}</Label>
        <DataTable
          mode="client"
          caption={tCommon("groups")}
          columns={groupColumns}
          rows={groups}
          getRowId={(row) => row.id}
          emptyTitle={t("pickerNoGroups")}
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
                ? tCommon("clear")
                : tCommon("selectAll")}
            </button>
          }
        />
      </div>
    </div>
  );
}
