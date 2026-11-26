export const PLATFORM_FIELDS = [
  "email",
  "first_name",
  "last_name",
  "department",
  "job_title",
  "employee_number",
  "phone",
  "location",
  "employment_type",
  "hire_date",
  "manager_email",
  "preferred_language",
  "external_id",
] as const;

export type PlatformField = (typeof PLATFORM_FIELDS)[number];

export type ColumnMap = Record<PlatformField, string | null>;

export type ImportSession = {
  id: string;
  original_filename: string;
  headers: string[];
  sample_rows: Array<Record<string, string>>;
  row_count: number;
  expires_at: string | null;
  suggested_map: ColumnMap;
  platform_fields: string[];
};

export type ImportMappingTemplate = {
  id: number;
  name: string;
  column_map: ColumnMap;
  updated_at?: string | null;
};

export type ImportRowError = {
  row: number;
  email: string | null;
  messages: string[];
};

export type ImportPreviewResult = {
  would_create: number;
  would_update: number;
  skipped: number;
  warning_count: number;
  errors: ImportRowError[];
};

export type ImportCommitResult = {
  created: number;
  updated: number;
  skipped: number;
  imported: number;
  errors: ImportRowError[];
  meta?: {
    auto_assigned_instance_count?: number;
    login_invited?: number;
    manager_skipped?: number;
    warning_count?: number;
  };
};

export type WizardStep = "upload" | "map" | "preview" | "result";

export function emptyColumnMap(): ColumnMap {
  return PLATFORM_FIELDS.reduce((acc, field) => {
    acc[field] = null;
    return acc;
  }, {} as ColumnMap);
}

export function normalizeColumnMap(input: Partial<Record<string, string | null>> | null | undefined): ColumnMap {
  const map = emptyColumnMap();
  if (!input) return map;
  for (const field of PLATFORM_FIELDS) {
    const value = input[field];
    map[field] = value && value.trim() !== "" ? value : null;
  }
  return map;
}
