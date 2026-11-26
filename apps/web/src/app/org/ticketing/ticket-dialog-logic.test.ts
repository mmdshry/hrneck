import { describe, expect, it } from "vitest";
import {
  buildGroupFields,
  defaultTicketDeskId,
  normalizeTicketPreferences,
  toImportPayload,
} from "./ticket-dialog-logic";

describe("normalizeTicketPreferences", () => {
  it("fills defaults for missing fields", () => {
    expect(normalizeTicketPreferences({})).toEqual({
      ticket_scope: "all",
      email_send_delay_minutes: 0,
      default_desk_id: null,
    });
  });

  it("keeps saved values", () => {
    expect(
      normalizeTicketPreferences({
        ticket_scope: "own",
        email_send_delay_minutes: 15,
        default_desk_id: 4,
      }),
    ).toEqual({ ticket_scope: "own", email_send_delay_minutes: 15, default_desk_id: 4 });
  });
});

describe("defaultTicketDeskId", () => {
  const desks = [
    { id: 1, type: "service" },
    { id: 2, type: "incident" },
  ];

  it("prefers the saved default desk", () => {
    expect(defaultTicketDeskId(9, desks)).toBe(9);
  });

  it("falls back to the first incident desk", () => {
    expect(defaultTicketDeskId(null, desks)).toBe(2);
  });

  it("falls back to the first desk when there is no incident desk", () => {
    expect(defaultTicketDeskId(null, [{ id: 5, type: "service" }])).toBe(5);
  });

  it("returns null when there are no desks", () => {
    expect(defaultTicketDeskId(null, [])).toBeNull();
  });
});

describe("buildGroupFields", () => {
  it("returns null when nothing is chosen", () => {
    expect(buildGroupFields({ stageId: "", priorityId: "", assigneePool: "   " })).toBeNull();
  });

  it("converts ids to numbers and trims the assignee pool", () => {
    expect(
      buildGroupFields({ stageId: "3", priorityId: "7", assigneePool: " tier1 " }),
    ).toEqual({ stage_id: 3, priority_id: 7, assignee_pool: "tier1" });
  });

  it("omits unset fields", () => {
    expect(buildGroupFields({ stageId: "", priorityId: "7", assigneePool: "" })).toEqual({
      priority_id: 7,
    });
  });
});

describe("toImportPayload", () => {
  it("wraps a bare array of tickets", () => {
    expect(toImportPayload([{ summary: "a" }])).toEqual({ tickets: [{ summary: "a" }] });
  });

  it("passes through an export that already has a tickets key", () => {
    const parsed = { tickets: [{ summary: "a" }], exported_at: "2026-01-01" };
    expect(toImportPayload(parsed)).toEqual(parsed);
  });
});
