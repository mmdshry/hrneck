import { isAppLocale, localeOptions, normalizeLocale } from "@/i18n/config";

export type DepartmentOption = {
  id: number;
  name: string;
  is_active?: boolean;
};

export type TargetManager = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
};

export type Target = {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  department?: string | null;
  department_id?: number | null;
  job_title?: string | null;
  manager_target_id?: number | null;
  manager?: TargetManager | null;
  hire_date?: string | null;
  employee_number?: string | null;
  phone?: string | null;
  location?: string | null;
  employment_type?: string | null;
  preferred_language?: string | null;
  timezone?: string | null;
  status?: string | null;
  external_id?: string | null;
  avatar_path?: string | null;
  avatar_url?: string | null;
  risk_score?: number | null;
  risk_tier?: string | null;
  risk_source?: string | null;
  risk_updated_at?: string | null;
  last_training_completed_at?: string | null;
  notification_opt_out?: boolean | null;
  joined_via?: string | null;
  user_id?: number | null;
  groups?: Array<{ id: number; name: string }>;
};

export type TargetFormState = {
  email: string;
  first_name: string;
  last_name: string;
  department_id: string;
  job_title: string;
  manager_target_id: string;
  hire_date: string;
  employee_number: string;
  phone: string;
  location: string;
  employment_type: string;
  preferred_language: string;
  timezone: string;
  external_id: string;
  notification_opt_out: boolean;
  status: string;
};

export const EMPLOYMENT_TYPE_OPTIONS = [
  { label: "Full time", value: "full_time" },
  { label: "Part time", value: "part_time" },
  { label: "Contractor", value: "contractor" },
  { label: "Intern", value: "intern" },
];

export const RISK_TIER_OPTIONS = [
  { label: "Unknown", value: "unknown" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

export const PREFERRED_LANGUAGE_OPTIONS = localeOptions;

export const CSV_HEADERS =
  "email,first_name,last_name,department,job_title,employee_number,phone,location,employment_type,hire_date,manager_email,preferred_language,timezone,external_id";

export function languageLabel(code: string | null | undefined): string {
  if (!code) {
    return "—";
  }
  const normalized = isAppLocale(code) ? code : normalizeLocale(code);
  return localeOptions.find((option) => option.code === normalized)?.label ?? normalized;
}

export function emptyTargetForm(): TargetFormState {
  return {
    email: "",
    first_name: "",
    last_name: "",
    department_id: "",
    job_title: "",
    manager_target_id: "",
    hire_date: "",
    employee_number: "",
    phone: "",
    location: "",
    employment_type: "",
    preferred_language: "",
    timezone: "UTC",
    external_id: "",
    notification_opt_out: false,
    status: "active",
  };
}

export function formFromTarget(target: Target): TargetFormState {
  const language = target.preferred_language?.trim() ?? "";
  return {
    email: target.email ?? "",
    first_name: target.first_name ?? "",
    last_name: target.last_name ?? "",
    department_id: target.department_id != null ? String(target.department_id) : "",
    job_title: target.job_title ?? "",
    manager_target_id: target.manager_target_id != null ? String(target.manager_target_id) : "",
    hire_date: target.hire_date ? String(target.hire_date).slice(0, 10) : "",
    employee_number: target.employee_number ?? "",
    phone: target.phone ?? "",
    location: target.location ?? "",
    employment_type: target.employment_type ?? "",
    preferred_language: language
      ? isAppLocale(language)
        ? language
        : normalizeLocale(language)
      : "",
    timezone: target.timezone?.trim() || "UTC",
    external_id: target.external_id ?? "",
    notification_opt_out: Boolean(target.notification_opt_out),
    status: target.status ?? "active",
  };
}

export function payloadFromForm(form: TargetFormState, options?: { includeStatus?: boolean }) {
  const body: Record<string, unknown> = {
    email: form.email.trim(),
    first_name: form.first_name.trim() || null,
    last_name: form.last_name.trim() || null,
    department_id: form.department_id ? Number(form.department_id) : null,
    job_title: form.job_title.trim() || null,
    manager_target_id: form.manager_target_id ? Number(form.manager_target_id) : null,
    hire_date: form.hire_date || null,
    employee_number: form.employee_number.trim() || null,
    phone: form.phone.trim() || null,
    location: form.location.trim() || null,
    employment_type: form.employment_type || null,
    preferred_language: form.preferred_language.trim() || null,
    timezone: form.timezone.trim() || "UTC",
    external_id: form.external_id.trim() || null,
    notification_opt_out: form.notification_opt_out,
  };

  if (options?.includeStatus) {
    body.status = form.status || "active";
  }

  return body;
}
