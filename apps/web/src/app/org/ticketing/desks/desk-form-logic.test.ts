import { describe, expect, it } from "vitest";
import {
  EMPTY_SUPPORT_FORM,
  buildStagePayload,
  buildSupportPayload,
  createDeskBody,
  deskFormFromDesk,
  emptyDeskForm,
  isDeskFormDirty,
  parseJsonArray,
  procedureFormFromProcedure,
  stageFormFromStage,
  updateDeskBody,
} from "./desk-form-logic";
import { isDeskType } from "./desk-types";

describe("desk form payloads", () => {
  it("creates active desks and sends a blank prefix as null", () => {
    expect(createDeskBody({ ...emptyDeskForm(), name: "Helpdesk", prefix: "" })).toEqual({
      name: "Helpdesk",
      type: "incident",
      number_prefix: null,
      is_active: true,
    });
  });

  it("updates name, prefix and status but never the type", () => {
    expect(
      updateDeskBody({ name: "Changes", type: "change", prefix: "CHG", active: false }),
    ).toEqual({ name: "Changes", number_prefix: "CHG", is_active: false });
  });

  it("reads a desk without a prefix as an empty prefix", () => {
    const desk = {
      id: 1,
      name: "Ops",
      slug: "ops",
      type: "incident",
      is_active: true,
    };
    expect(deskFormFromDesk(desk)).toEqual({
      name: "Ops",
      type: "incident",
      prefix: "",
      active: true,
    });
  });

  it("detects a changed field as dirty", () => {
    const initial = emptyDeskForm();
    expect(isDeskFormDirty({ ...initial }, initial)).toBe(false);
    expect(isDeskFormDirty({ ...initial, name: "Ops" }, initial)).toBe(true);
    expect(isDeskFormDirty({ ...initial, active: false }, initial)).toBe(true);
  });
});

describe("stage payloads", () => {
  it("uses defaults for a new stage", () => {
    expect(stageFormFromStage(null)).toEqual({
      name: "",
      sequence: "0",
      escalation: "",
      terminal: false,
    });
  });

  it("converts blank sequence to 0 and blank escalation to null", () => {
    expect(
      buildStagePayload({ name: "Triage", sequence: "", escalation: "", terminal: false }),
    ).toEqual({
      name: "Triage",
      sequence: 0,
      default_escalation_minutes: null,
      is_terminal: false,
    });
  });

  it("converts numeric text to numbers", () => {
    expect(
      buildStagePayload({ name: "Closed", sequence: "3", escalation: "30", terminal: true }),
    ).toEqual({
      name: "Closed",
      sequence: 3,
      default_escalation_minutes: 30,
      is_terminal: true,
    });
  });
});

describe("support row payloads", () => {
  it("sends is_closed only for statuses", () => {
    const form = { ...EMPTY_SUPPORT_FORM, name: "Waiting", closed: true, weight: "5" };
    expect(buildSupportPayload("statuses", form)).toEqual({ name: "Waiting", is_closed: true });
  });

  it("sends weight only for priorities", () => {
    const form = { ...EMPTY_SUPPORT_FORM, name: "High", weight: "7" };
    expect(buildSupportPayload("priorities", form)).toEqual({ name: "High", weight: 7 });
  });

  it("omits a blank slug so the server derives it", () => {
    const payload = buildSupportPayload("categories", { ...EMPTY_SUPPORT_FORM, name: "Access" });
    expect(payload.slug).toBeUndefined();
    expect(payload).not.toHaveProperty("is_closed");
    expect(payload).not.toHaveProperty("weight");
  });
});

describe("procedure form", () => {
  it("starts from the default steps for a new procedure", () => {
    const form = procedureFormFromProcedure(null);
    expect(form).toMatchObject({ name: "", hook: "on_create", stageId: "", active: true });
    expect(JSON.parse(form.stepsJson)).toEqual([{ action: "assign_pool", pool: "tier1" }]);
  });

  it("maps a missing stage to an empty select value", () => {
    const form = procedureFormFromProcedure({
      id: 2,
      name: "Notify",
      hook: "on_escalation",
      stage_id: null,
      is_active: false,
      steps: [{ action: "notify" }],
    });
    expect(form.stageId).toBe("");
    expect(form.active).toBe(false);
    expect(JSON.parse(form.stepsJson)).toEqual([{ action: "notify" }]);
  });
});

describe("parseJsonArray", () => {
  it("returns the array", () => {
    expect(parseJsonArray('[{"action":"notify"}]')).toEqual([{ action: "notify" }]);
  });

  it("returns null when the JSON is not an array", () => {
    expect(parseJsonArray('{"action":"notify"}')).toBeNull();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJsonArray("[")).toThrow(SyntaxError);
  });
});

describe("isDeskType", () => {
  it("accepts the supported desk types", () => {
    expect(isDeskType("kb")).toBe(true);
    expect(isDeskType("service_request")).toBe(true);
  });

  it("rejects unknown desk types", () => {
    expect(isDeskType("legacy")).toBe(false);
  });
});
