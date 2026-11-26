import { datetimeLocalToIso } from "./training-shared";

/** Form state shared by the campaign launch and the assign-content wizards. */
export type AssignDraft = {
  courseIds: number[];
  targetIds: number[];
  groupIds: number[];
  startsAt: string;
  expiresAt: string;
};

export function emptyAssignDraft(): AssignDraft {
  return { courseIds: [], targetIds: [], groupIds: [], startsAt: "", expiresAt: "" };
}

/** True once anything is picked, so closing the wizard asks before discarding. */
export function isAssignDraftDirty(draft: AssignDraft): boolean {
  return (
    draft.courseIds.length > 0 ||
    draft.targetIds.length > 0 ||
    draft.groupIds.length > 0 ||
    draft.startsAt !== "" ||
    draft.expiresAt !== ""
  );
}

/** Audience and window fields for the request body. Empty values are omitted. */
export function assignAudiencePayload(draft: AssignDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (draft.targetIds.length > 0) payload.target_ids = draft.targetIds;
  if (draft.groupIds.length > 0) payload.group_ids = draft.groupIds;
  const startsIso = datetimeLocalToIso(draft.startsAt);
  if (startsIso) payload.starts_at = startsIso;
  const expiresIso = datetimeLocalToIso(draft.expiresAt);
  if (expiresIso) payload.expires_at = expiresIso;
  return payload;
}

export function toggleId(ids: readonly number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id];
}

/** Clears the selection when every id is already selected, otherwise selects all. */
export function toggleAllIds(selectedIds: readonly number[], allIds: readonly number[]): number[] {
  return selectedIds.length === allIds.length ? [] : [...allIds];
}
