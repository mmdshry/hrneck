import type { SdDesk } from "./ticketing-types";

export type TicketPreferences = {
  ticket_scope: string;
  email_send_delay_minutes: number;
  default_desk_id: number | null;
};

export function normalizeTicketPreferences(data: Partial<TicketPreferences>): TicketPreferences {
  return {
    ticket_scope: data.ticket_scope ?? "all",
    email_send_delay_minutes: data.email_send_delay_minutes ?? 0,
    default_desk_id: data.default_desk_id ?? null,
  };
}

/** Desk preselected for a new ticket: the saved default, else the first incident desk, else the first desk. */
export function defaultTicketDeskId(
  defaultDeskId: number | null,
  desks: ReadonlyArray<Pick<SdDesk, "id" | "type">>,
): number | null {
  if (defaultDeskId) {
    return defaultDeskId;
  }
  const preferred = desks.find((desk) => desk.type === "incident") ?? desks[0];
  return preferred?.id ?? null;
}

export type GroupFieldInput = {
  stageId: string;
  priorityId: string;
  assigneePool: string;
};

/** Payload for the bulk `group_update` action, or null when no field is set. */
export function buildGroupFields(input: GroupFieldInput): Record<string, string | number> | null {
  const fields: Record<string, string | number> = {};
  if (input.stageId) {
    fields.stage_id = Number(input.stageId);
  }
  if (input.priorityId) {
    fields.priority_id = Number(input.priorityId);
  }
  const assigneePool = input.assigneePool.trim();
  if (assigneePool) {
    fields.assignee_pool = assigneePool;
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

/** Wraps a parsed export for `POST /import`: a bare array of tickets becomes `{ tickets }`. */
export function toImportPayload(parsed: unknown): { tickets: unknown } {
  if (parsed && typeof parsed === "object" && "tickets" in parsed) {
    return parsed as { tickets: unknown };
  }
  return { tickets: parsed };
}
