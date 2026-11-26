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

/** `labelKey` is a key under `org.checklists`; resolve it with `t(labelKey)` in the UI. */
export const ITEM_TYPES: { value: ChecklistItemType; labelKey: string }[] = [
  { value: "section", labelKey: "itemTypeSection" },
  { value: "checkbox", labelKey: "itemTypeCheckbox" },
  { value: "short_text", labelKey: "itemTypeShortText" },
  { value: "long_text", labelKey: "itemTypeLongText" },
  { value: "single_select", labelKey: "itemTypeSingleSelect" },
  { value: "multi_select", labelKey: "itemTypeMultiSelect" },
  { value: "date", labelKey: "itemTypeDate" },
  { value: "number", labelKey: "itemTypeNumber" },
  { value: "file", labelKey: "itemTypeFile" },
  { value: "link", labelKey: "itemTypeLink" },
  { value: "rich_note", labelKey: "itemTypeRichNote" },
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
