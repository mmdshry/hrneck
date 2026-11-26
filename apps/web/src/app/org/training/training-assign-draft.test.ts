import { describe, expect, it } from "vitest";
import {
  assignAudiencePayload,
  emptyAssignDraft,
  isAssignDraftDirty,
  toggleAllIds,
  toggleId,
  type AssignDraft,
} from "./training-assign-draft";

function draftWith(patch: Partial<AssignDraft>): AssignDraft {
  return { ...emptyAssignDraft(), ...patch };
}

describe("isAssignDraftDirty", () => {
  it("is clean for an empty draft", () => {
    expect(isAssignDraftDirty(emptyAssignDraft())).toBe(false);
  });

  it("is dirty once any course, audience or window field is set", () => {
    expect(isAssignDraftDirty(draftWith({ courseIds: [1] }))).toBe(true);
    expect(isAssignDraftDirty(draftWith({ targetIds: [2] }))).toBe(true);
    expect(isAssignDraftDirty(draftWith({ groupIds: [3] }))).toBe(true);
    expect(isAssignDraftDirty(draftWith({ startsAt: "2026-12-01T09:00" }))).toBe(true);
    expect(isAssignDraftDirty(draftWith({ expiresAt: "2026-12-31T17:30" }))).toBe(true);
  });
});

describe("assignAudiencePayload", () => {
  it("omits audience and window fields that are empty", () => {
    expect(assignAudiencePayload(emptyAssignDraft())).toEqual({});
  });

  it("sends selected ids and converts the window to ISO timestamps", () => {
    const payload = assignAudiencePayload(
      draftWith({
        courseIds: [1],
        targetIds: [4, 5],
        groupIds: [9],
        startsAt: "2026-12-01T09:00",
        expiresAt: "2026-12-31T17:30",
      }),
    );

    expect(payload).toEqual({
      target_ids: [4, 5],
      group_ids: [9],
      starts_at: new Date("2026-12-01T09:00").toISOString(),
      expires_at: new Date("2026-12-31T17:30").toISOString(),
    });
  });
});

describe("toggleId", () => {
  it("adds a missing id and removes a selected one without mutating the input", () => {
    const input = [1, 2];

    expect(toggleId(input, 3)).toEqual([1, 2, 3]);
    expect(toggleId(input, 1)).toEqual([2]);
    expect(input).toEqual([1, 2]);
  });
});

describe("toggleAllIds", () => {
  it("selects every id unless they are all selected already", () => {
    expect(toggleAllIds([], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(toggleAllIds([1], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(toggleAllIds([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it("returns a new array instead of the list it was given", () => {
    const allIds = [1, 2];

    expect(toggleAllIds([], allIds)).not.toBe(allIds);
  });
});
