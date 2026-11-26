import { describe, expect, it } from "vitest";
import {
  emptyUserReportForm,
  employeeLabel,
  isUserReportFormDirty,
  periodTypeFor,
  userReportPayload,
} from "./user-report-form";

const ana = { id: 7, name: "Ana Admin", email: "ana@itneck.test" };

describe("periodTypeFor", () => {
  it("treats keys with a quarter suffix as quarterly", () => {
    expect(periodTypeFor("2026-Q3")).toBe("quarterly");
    expect(periodTypeFor("2026-03")).toBe("monthly");
  });
});

describe("userReportPayload", () => {
  it("returns null for a single-employee report without an employee", () => {
    const form = { ...emptyUserReportForm("2026-Q3"), mode: "single" as const };

    expect(userReportPayload(form)).toBeNull();
  });

  it("targets the chosen employee and carries the training option", () => {
    const form = {
      ...emptyUserReportForm("2026-03"),
      selectedTarget: ana,
      includeTraining: false,
    };

    expect(userReportPayload(form)).toEqual({
      scope: "user",
      period_type: "monthly",
      period_key: "2026-03",
      include_training: false,
      mode: "single",
      target_id: 7,
    });
  });

  it("sends the selected group in list mode and omits it when all groups are chosen", () => {
    const group = { ...emptyUserReportForm("2026-Q1"), mode: "list" as const, groupId: "4" };

    expect(userReportPayload(group)).toMatchObject({ mode: "list", group_id: 4 });
    expect(userReportPayload({ ...group, groupId: "" })?.group_id).toBeUndefined();
  });
});

describe("isUserReportFormDirty", () => {
  it("is clean for the starting form and dirty once a field changes", () => {
    const initial = emptyUserReportForm("2026-Q3");

    expect(isUserReportFormDirty(initial, initial)).toBe(false);
    expect(isUserReportFormDirty({ ...initial, employeeSearch: "an" }, initial)).toBe(true);
    expect(isUserReportFormDirty({ ...initial, selectedTarget: ana }, initial)).toBe(true);
  });
});

describe("employeeLabel", () => {
  it("shows the email alone when the name is missing", () => {
    expect(employeeLabel({ id: 1, name: "ana@itneck.test", email: "ana@itneck.test" })).toBe(
      "ana@itneck.test",
    );
    expect(employeeLabel(ana)).toBe("Ana Admin (ana@itneck.test)");
  });
});
