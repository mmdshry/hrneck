import { describe, expect, it } from "vitest";
import {
  emptyScheduleForm,
  hasUnavailableRecipients,
  isScheduleFormDirty,
  nextCadenceForFormat,
  recipientPickerOptions,
  scheduleFormFromSchedule,
  scheduleRequestBody,
  type ReportRecipient,
  type ReportSchedule,
} from "./report-schedule-form";

const eligible: ReportRecipient[] = [
  { id: 1, name: "Ana Admin", email: "ana@itneck.test" },
  { id: 2, name: "Bob Viewer", email: "bob@itneck.test" },
];

const schedule: ReportSchedule = {
  id: 10,
  name: "Monthly CSV",
  cadence: "monthly",
  format: "csv",
  section: "campaigns",
  recipients: [
    { id: 1, name: "Ana Admin", email: "ana@itneck.test", eligible: true },
    { id: 3, name: "Former Member", email: "former@itneck.test", eligible: false },
  ],
};

describe("nextCadenceForFormat", () => {
  it("moves a weekly cadence to monthly when switching to PDF", () => {
    expect(nextCadenceForFormat("pdf", "weekly")).toBe("monthly");
  });

  it("keeps the cadence for CSV and for non-weekly PDF cadences", () => {
    expect(nextCadenceForFormat("csv", "weekly")).toBe("weekly");
    expect(nextCadenceForFormat("pdf", "quarterly")).toBe("quarterly");
  });
});

describe("isScheduleFormDirty", () => {
  it("is clean when recipients are reordered but not changed", () => {
    const initial = scheduleFormFromSchedule({
      ...schedule,
      recipients: [
        { id: 1, name: "Ana Admin", email: "ana@itneck.test", eligible: true },
        { id: 2, name: "Bob Viewer", email: "bob@itneck.test", eligible: true },
      ],
    });

    expect(isScheduleFormDirty({ ...initial, recipientIds: [2, 1] }, initial)).toBe(false);
  });

  it("is dirty when a recipient is added", () => {
    const initial = emptyScheduleForm("Monthly CSV");

    expect(isScheduleFormDirty({ ...initial, recipientIds: [2] }, initial)).toBe(true);
  });
});

describe("recipientPickerOptions", () => {
  it("offers only eligible members when creating a schedule", () => {
    expect(recipientPickerOptions(eligible, null)).toEqual(eligible);
  });

  it("keeps a schedule's unavailable recipients selectable when editing", () => {
    expect(recipientPickerOptions(eligible, schedule)).toEqual([
      ...eligible,
      { id: 3, name: "Former Member", email: "former@itneck.test", unavailable: true },
    ]);
  });
});

describe("hasUnavailableRecipients", () => {
  it("flags a selected person who no longer has report access", () => {
    expect(hasUnavailableRecipients([1, 3], eligible)).toBe(true);
    expect(hasUnavailableRecipients([1, 2], eligible)).toBe(false);
  });
});

describe("scheduleRequestBody", () => {
  it("maps the form to the API payload", () => {
    expect(
      scheduleRequestBody({
        name: "Weekly",
        cadence: "weekly",
        format: "csv",
        section: "training",
        recipientIds: [2],
      }),
    ).toEqual({
      name: "Weekly",
      cadence: "weekly",
      format: "csv",
      section: "training",
      recipient_user_ids: [2],
    });
  });
});
