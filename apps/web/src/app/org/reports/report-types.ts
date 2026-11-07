export type ReportTab =
  | "overview"
  | "company"
  | "users"
  | "targets"
  | "campaigns"
  | "training"
  | "checklists"
  | "ticketing";

export type ReportSection =
  | "company"
  | "users"
  | "targets"
  | "campaigns"
  | "recipients"
  | "training"
  | "checklists"
  | "ticketing";

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type CampaignSummary = Record<string, number>;

export type DetailedOverview = {
  campaign: CampaignSummary;
  counts: {
    users: number;
    targets: number;
    groups: number;
    campaigns: number;
    enrollments: number;
    checklist_templates: number;
    checklist_instances: number;
    tickets_open: number;
    tickets_resolved: number;
  };
  company: CompanyPayload;
  training_by_status: Record<string, number>;
  checklists_by_status: Record<string, number>;
  ticketing: TicketingSummary;
};

export type CompanyPayload = {
  profile: {
    display_name: string | null;
    primary_color: string | null;
    timezone: string | null;
    logo_path: string | null;
    sending_domain: string | null;
    webhook_url: string | null;
    updated_at: string | null;
  };
  by_department: Array<{
    department: string;
    targets: number;
    sent: number;
    opened: number;
    clicked: number;
    click_rate: number;
  }>;
  by_group: Array<{
    id: number;
    name: string;
    targets: number;
    source: string | null;
  }>;
  by_role: Array<{
    role: string;
    users: number;
  }>;
};

export type TicketingSummary = {
  total_open: number;
  total_resolved: number;
  sla_response_breached: number;
  sla_resolve_breached: number;
  by_stage: Record<string, number>;
  by_priority: Record<string, number>;
  by_desk: Record<string, number>;
};

export type SectionResponse<T> = {
  section: string;
  data: T[] | CompanyPayload;
  meta?: PaginationMeta;
  summary?: Record<string, unknown>;
};

export const REPORT_TABS: Array<{ id: ReportTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "company", label: "Company" },
  { id: "users", label: "Users" },
  { id: "targets", label: "People" },
  { id: "campaigns", label: "Campaigns" },
  { id: "training", label: "Training" },
  { id: "checklists", label: "Checklists" },
  { id: "ticketing", label: "Ticketing" },
];
