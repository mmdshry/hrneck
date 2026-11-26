import { describe, expect, it } from "vitest";
import { moveTemplateId, toggleTemplateId } from "./pack-template-order";

describe("toggleTemplateId", () => {
  it("appends an unselected template so selection order is assign order", () => {
    expect(toggleTemplateId([3, 1], 2)).toEqual([3, 1, 2]);
  });

  it("removes a selected template and keeps the rest in order", () => {
    expect(toggleTemplateId([3, 1, 2], 1)).toEqual([3, 2]);
  });
});

describe("moveTemplateId", () => {
  it("moves a template up one position", () => {
    expect(moveTemplateId([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
  });

  it("moves a template down one position", () => {
    expect(moveTemplateId([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
  });

  it("returns the same list when the first item moves up", () => {
    const ids = [1, 2, 3];
    expect(moveTemplateId(ids, 1, -1)).toBe(ids);
  });

  it("returns the same list when the last item moves down", () => {
    const ids = [1, 2, 3];
    expect(moveTemplateId(ids, 3, 1)).toBe(ids);
  });

  it("returns the same list for a template that is not selected", () => {
    const ids = [1, 2, 3];
    expect(moveTemplateId(ids, 9, 1)).toBe(ids);
  });

  it("does not mutate the input list", () => {
    const ids = [1, 2, 3];
    moveTemplateId(ids, 3, -1);
    expect(ids).toEqual([1, 2, 3]);
  });
});
