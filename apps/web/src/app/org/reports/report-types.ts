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

export type CampaignSummary = {
  campaigns: number;
  campaigns_running: number;
  recipients: number;
  opened: number;
  completed: number;
  no_action: number;
  opened_pct: number;
  completed_pct: number;
  no_action_pct: number;
  enrollments: number;
  active_employees: number;
};

export type StatusSegments = Record<string, number>;

export type TrainingBlock = {
  assigned: number;
  in_progress: number;
  completed: number;
  total: number;
  completion_rate: number;
  by_status: StatusSegments;
  segments: StatusSegments;
};

export type ChecklistsBlock = {
  open: number;
  completed: number;
  total: number;
  completion_rate: number;
  by_status: StatusSegments;
  segments: StatusSegments;
};

export type TicketingBlock = {
  open: number;
  resolved: number;
  sla_response_breached: number;
  sla_resolve_breached: number;
  segments: StatusSegments;
};

export type CampaignsPeopleBlock = {
  campaigns_running: number;
  opened_pct: number;
  completed_pct: number;
  no_action_pct: number;
  active_employees: number;
  segments: StatusSegments;
};

export type OverviewBlocks = {
  training: TrainingBlock;
  checklists: ChecklistsBlock;
  ticketing: TicketingBlock;
  campaigns_people: CampaignsPeopleBlock;
};

export type DetailedOverview = {
  campaign: CampaignSummary;
  blocks: OverviewBlocks;
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
    completed: number;
    no_action: number;
    opened_pct: number;
    completed_pct: number;
    no_action_pct: number;
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

export type ReportSharedFilters = {
  department_id?: string;
  from?: string;
  to?: string;
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
  { id: "targets", label: "Employees" },
  { id: "campaigns", label: "Campaigns" },
  { id: "training", label: "Training" },
  { id: "checklists", label: "Checklists" },
  { id: "ticketing", label: "Ticketing" },
];
