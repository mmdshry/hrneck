import type { SdDesk } from "../ticketing-types";

export const DESK_TYPES = ["incident", "problem", "service_request", "change", "kb"] as const;

export type DeskType = (typeof DESK_TYPES)[number];

export function isDeskType(value: string): value is DeskType {
  return (DESK_TYPES as readonly string[]).includes(value);
}

export type DeskStage = NonNullable<SdDesk["stages"]>[number];
export type DeskProcedure = NonNullable<SdDesk["procedures"]>[number];
export type DeskSla = NonNullable<SdDesk["sla_policies"]>[number];
export type DeskSupportRow = { id: number; name: string; slug: string };

export type SupportTable = "statuses" | "priorities" | "severities" | "categories";

export type TemplateMessage = {
  id: number;
  name: string;
  subject?: string | null;
  body: string;
  desk_id?: number | null;
};

export type TemplateNote = {
  id: number;
  name: string;
  body: string;
  desk_id?: number | null;
};

/** Modal opened from the selected desk's detail or templates panel. */
export type DeskDialog =
  | { kind: "stage"; stage: DeskStage | null }
  | { kind: "procedure"; procedure: DeskProcedure | null }
  | { kind: "sla"; policy: DeskSla | null }
  | { kind: "support"; table: SupportTable }
  | { kind: "messageTemplate" }
  | { kind: "noteTemplate" };
