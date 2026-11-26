/**
 * Pure helpers for arranging courses inside a training campaign.
 *
 * Mirrors the API rules in `SyncCampaignCourses`: the course list is only
 * editable while the campaign is still a draft or scheduled.
 */

const EDITABLE_COURSE_STATUSES = new Set(["draft", "scheduled"]);

export function isCourseListEditable(status: string): boolean {
  return EDITABLE_COURSE_STATUSES.has(status);
}

export function addCourseId(
  courseIds: readonly number[],
  courseId: number,
): number[] {
  return courseIds.includes(courseId)
    ? [...courseIds]
    : [...courseIds, courseId];
}

export function removeCourseId(
  courseIds: readonly number[],
  courseId: number,
): number[] {
  return courseIds.filter((id) => id !== courseId);
}

/** Swaps a course with its neighbour. Out-of-range moves return the same order. */
export function moveCourseId(
  courseIds: readonly number[],
  courseId: number,
  delta: -1 | 1,
): number[] {
  const from = courseIds.indexOf(courseId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= courseIds.length) return [...courseIds];

  const next = [...courseIds];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/**
 * Drag-and-drop reorder: takes `activeId` out of its slot and places it where
 * `overId` currently sits (same semantics as dnd-kit's `arrayMove`).
 */
export function reorderCourseId(
  courseIds: readonly number[],
  activeId: number,
  overId: number,
): number[] {
  const from = courseIds.indexOf(activeId);
  const to = courseIds.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return [...courseIds];

  const next = [...courseIds];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

export const DND_TYPES = ["library", "member", "cell", "panel"] as const;
export type DndType = (typeof DND_TYPES)[number];

/**
 * Encodes draggable and droppable ids as `type:number`, e.g. `library:12`.
 * - `library` is a course card in the course library.
 * - `member` is a course row inside the selected campaign.
 * - `cell` is a campaign's courses cell in the campaigns table.
 * - `panel` is the selected campaign's detail panel.
 */
export function dndId(type: DndType, id: number): string {
  return `${type}:${id}`;
}

export function parseDndId(raw: string): { type: DndType; id: number } | null {
  const match = /^([a-z]+):(\d+)$/.exec(raw);
  if (!match) return null;

  const type = DND_TYPES.find((candidate) => candidate === match[1]);
  if (!type) return null;

  return { type, id: Number(match[2]) };
}
