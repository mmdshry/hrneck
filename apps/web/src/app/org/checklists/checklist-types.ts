export type ChecklistItemType =
  | "section"
  | "checkbox"
  | "short_text"
  | "long_text"
  | "single_select"
  | "multi_select"
  | "date"
  | "number"
  | "file"
  | "link"
  | "rich_note";

export type VisibilityRule = {
  item_key: string;
  op: "eq" | "neq" | "in" | "not_empty";
  value?: unknown;
};

export type ChecklistItem = {
  key: string;
  type: ChecklistItemType;
  label: string;
  help?: string | null;
  required?: boolean;
  order: number;
  options?: { value: string; label: string }[];
  media?: { kind: string; url?: string | null; label?: string | null } | null;
  visible_when?: VisibilityRule | null;
  requires?: string[];
};

export type ChecklistTemplate = {
  id: number;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  status: string;
  is_system: boolean;
  current_version: number;
  schema_json?: { items: ChecklistItem[] };
  updated_at?: string | null;
};

export type ChecklistPack = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  auto_assign_on_create: boolean;
  template_ids: number[];
  templates?: Array<{
    id: number;
    name: string;
    category?: string | null;
    status?: string | null;
    is_system?: boolean;
    sort_order?: number;
  }>;
  updated_at?: string | null;
};

export type ChecklistInstance = {
  id: number;
  template_id: number;
  title: string;
  status: string;
  progress_pct: number;
  target_id: number;
  target?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    department?: string | null;
  } | null;
  template?: { id: number; name: string; category: string } | null;
  schema_snapshot?: { items: ChecklistItem[] };
  answers?: {
    item_key: string;
    value: unknown;
    file_disk_path?: string | null;
    file_mime?: string | null;
    file_size?: number | null;
  }[];
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

export type AuditEvent = {
  id: number;
  event: string | null;
  description: string;
  subject_type: string | null;
  subject_id: number | null;
  causer_id: number | null;
  properties: Record<string, unknown>;
  created_at: string | null;
};

export const ITEM_TYPES: { value: ChecklistItemType; label: string }[] = [
  { value: "section", label: "Section" },
  { value: "checkbox", label: "Checkbox" },
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "single_select", label: "Single select" },
  { value: "multi_select", label: "Multi select" },
  { value: "date", label: "Date" },
  { value: "number", label: "Number" },
  { value: "file", label: "File upload" },
  { value: "link", label: "Link" },
  { value: "rich_note", label: "Rich note" },
];

export const ANSWERABLE = new Set<ChecklistItemType>([
  "checkbox",
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
  "date",
  "number",
  "file",
]);

export function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value === true;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function isVisible(item: ChecklistItem, answers: Record<string, unknown>): boolean {
  const rule = item.visible_when;
  if (!rule?.item_key) return true;
  const actual = answers[rule.item_key];
  switch (rule.op) {
    case "eq":
      return actual == rule.value || (rule.value === true && actual === true);
    case "neq":
      return actual != rule.value;
    case "in":
      return Array.isArray(rule.value) && rule.value.includes(actual as never);
    case "not_empty":
      return isFilled(actual);
    default:
      return true;
  }
}

export function newItemKey(): string {
  return `item_${Math.random().toString(36).slice(2, 9)}`;
}
