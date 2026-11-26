import { describe, expect, it } from "vitest";
import {
  addCourseId,
  dndId,
  isCourseListEditable,
  moveCourseId,
  parseDndId,
  removeCourseId,
  reorderCourseId,
} from "./campaign-courses";

describe("isCourseListEditable", () => {
  it("allows changes only while draft or scheduled", () => {
    expect(isCourseListEditable("draft")).toBe(true);
    expect(isCourseListEditable("scheduled")).toBe(true);
    expect(isCourseListEditable("running")).toBe(false);
    expect(isCourseListEditable("completed")).toBe(false);
    expect(isCourseListEditable("cancelled")).toBe(false);
    expect(isCourseListEditable("archived")).toBe(false);
  });
});

describe("addCourseId / removeCourseId", () => {
  it("appends new courses and ignores duplicates", () => {
    expect(addCourseId([1, 2], 3)).toEqual([1, 2, 3]);
    expect(addCourseId([1, 2], 2)).toEqual([1, 2]);
  });

  it("removes a course without touching the rest of the order", () => {
    expect(removeCourseId([3, 1, 2], 1)).toEqual([3, 2]);
    expect(removeCourseId([3, 1, 2], 9)).toEqual([3, 1, 2]);
  });

  it("never mutates its input", () => {
    const input = [1, 2];
    addCourseId(input, 3);
    removeCourseId(input, 1);
    expect(input).toEqual([1, 2]);
  });
});

describe("moveCourseId", () => {
  it("swaps a course with the neighbour above or below", () => {
    expect(moveCourseId([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moveCourseId([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
  });

  it("keeps the order when moving past either end", () => {
    expect(moveCourseId([1, 2, 3], 1, -1)).toEqual([1, 2, 3]);
    expect(moveCourseId([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
  });

  it("keeps the order for unknown courses", () => {
    expect(moveCourseId([1, 2], 9, 1)).toEqual([1, 2]);
  });
});

describe("reorderCourseId", () => {
  it("moves a dragged course down to the position of the target", () => {
    expect(reorderCourseId([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
  });

  it("moves a dragged course up to the position of the target", () => {
    expect(reorderCourseId([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
  });

  it("returns the same order when dropped on itself or unknown ids", () => {
    expect(reorderCourseId([1, 2, 3], 2, 2)).toEqual([1, 2, 3]);
    expect(reorderCourseId([1, 2, 3], 9, 2)).toEqual([1, 2, 3]);
    expect(reorderCourseId([1, 2, 3], 2, 9)).toEqual([1, 2, 3]);
  });
});

describe("dndId / parseDndId", () => {
  it("round-trips every drag type", () => {
    for (const type of ["library", "member", "cell", "panel"] as const) {
      expect(parseDndId(dndId(type, 42))).toEqual({ type, id: 42 });
    }
  });

  it("rejects unknown types and malformed ids", () => {
    expect(parseDndId("course:1")).toBeNull();
    expect(parseDndId("library:")).toBeNull();
    expect(parseDndId("library:abc")).toBeNull();
    expect(parseDndId("")).toBeNull();
  });
});
