"use client";

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

export function AudiencePicker({
  targets,
  groups,
  selectedTargetIds,
  selectedGroupIds,
  onChangeTargets,
  onChangeGroups,
}: AudiencePickerProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[var(--muted-foreground)]">Targets</Label>
          <button
            type="button"
            className="text-xs text-[var(--muted-foreground)] underline-offset-2 hover:underline"
            onClick={() =>
              onChangeTargets(
                selectedTargetIds.length === targets.length
                  ? []
                  : targets.map((t) => t.id),
              )
            }
          >
            {selectedTargetIds.length === targets.length ? "Clear" : "Select all"}
          </button>
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
          {targets.length === 0 ? (
            <p className="px-1 py-2 text-sm text-[var(--muted-foreground)]">No targets</p>
          ) : (
            targets.map((target) => (
              <label
                key={target.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
              >
                <input
                  type="checkbox"
                  checked={selectedTargetIds.includes(target.id)}
                  onChange={() => onChangeTargets(toggleId(selectedTargetIds, target.id))}
                />
                <span className="truncate">
                  {target.first_name ? `${target.first_name} · ` : ""}
                  {target.email}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[var(--muted-foreground)]">Groups</Label>
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
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
          {groups.length === 0 ? (
            <p className="px-1 py-2 text-sm text-[var(--muted-foreground)]">No groups</p>
          ) : (
            groups.map((group) => (
              <label
                key={group.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--muted)]"
              >
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => onChangeGroups(toggleId(selectedGroupIds, group.id))}
                />
                <span className="truncate">
                  {group.name}
                  {typeof group.targets_count === "number"
                    ? ` · ${group.targets_count}`
                    : ""}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
