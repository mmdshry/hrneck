import type { SdDesk } from "../ticketing-types";
import type { DeskProcedure, DeskSla, DeskStage, SupportTable } from "./desk-types";

export type DeskForm = {
  name: string;
  type: string;
  prefix: string;
  active: boolean;
};

export function emptyDeskForm(): DeskForm {
  return { name: "", type: "incident", prefix: "", active: true };
}

export function deskFormFromDesk(desk: SdDesk): DeskForm {
  return {
    name: desk.name,
    type: desk.type,
    prefix: desk.number_prefix ?? "",
    active: desk.is_active,
  };
}

export function isDeskFormDirty(form: DeskForm, initial: DeskForm): boolean {
  return (
    form.name !== initial.name ||
    form.type !== initial.type ||
    form.prefix !== initial.prefix ||
    form.active !== initial.active
  );
}

/** Body for `POST /desks`. New desks are always active. */
export function createDeskBody(form: DeskForm) {
  return {
    name: form.name,
    type: form.type,
    number_prefix: form.prefix || null,
    is_active: true,
  };
}

/** Body for `PATCH /desks/{id}`. The type is fixed once the desk exists. */
export function updateDeskBody(form: DeskForm) {
  return {
    name: form.name,
    number_prefix: form.prefix,
    is_active: form.active,
  };
}

export type StageForm = {
  name: string;
  sequence: string;
  escalation: string;
  terminal: boolean;
};

export function stageFormFromStage(stage: DeskStage | null): StageForm {
  if (!stage) {
    return { name: "", sequence: "0", escalation: "", terminal: false };
  }
  return {
    name: stage.name,
    sequence: String(stage.sequence),
    escalation:
      stage.default_escalation_minutes != null ? String(stage.default_escalation_minutes) : "",
    terminal: stage.is_terminal,
  };
}

export function buildStagePayload(form: StageForm) {
  return {
    name: form.name,
    sequence: Number(form.sequence) || 0,
    default_escalation_minutes: form.escalation ? Number(form.escalation) : null,
    is_terminal: form.terminal,
  };
}

const DEFAULT_PROCEDURE_STEPS = '[{"action":"assign_pool","pool":"tier1"}]';

export type ProcedureForm = {
  name: string;
  hook: string;
  stageId: string;
  active: boolean;
  stepsJson: string;
};

export function procedureFormFromProcedure(procedure: DeskProcedure | null): ProcedureForm {
  if (!procedure) {
    return {
      name: "",
      hook: "on_create",
      stageId: "",
      active: true,
      stepsJson: DEFAULT_PROCEDURE_STEPS,
    };
  }
  return {
    name: procedure.name,
    hook: procedure.hook,
    stageId: procedure.stage_id != null ? String(procedure.stage_id) : "",
    active: procedure.is_active,
    stepsJson: JSON.stringify(procedure.steps ?? [], null, 2),
  };
}

const DEFAULT_SLA_GOALS = '[{"priority_slug":"medium","response_minutes":240,"resolve_minutes":1440}]';

export type SlaForm = {
  name: string;
  goalsJson: string;
  isDefault: boolean;
};

export function slaFormFromPolicy(policy: DeskSla | null): SlaForm {
  if (!policy) {
    return { name: "", goalsJson: DEFAULT_SLA_GOALS, isDefault: false };
  }
  return {
    name: policy.name,
    goalsJson: JSON.stringify(policy.goals ?? [], null, 2),
    isDefault: policy.is_default,
  };
}

export type SupportForm = {
  name: string;
  slug: string;
  closed: boolean;
  weight: string;
};

export const EMPTY_SUPPORT_FORM: SupportForm = { name: "", slug: "", closed: false, weight: "0" };

/** Body for a support row. Only statuses send `is_closed`; only priorities send `weight`. */
export function buildSupportPayload(
  table: SupportTable,
  form: SupportForm,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name,
    slug: form.slug || undefined,
  };
  if (table === "statuses") payload.is_closed = form.closed;
  if (table === "priorities") payload.weight = Number(form.weight) || 0;
  return payload;
}

/** Parses a JSON array typed into a textarea. Throws on invalid JSON and returns null when the value is not an array. */
export function parseJsonArray(text: string): unknown[] | null {
  const parsed: unknown = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : null;
}
