export type SdDesk = {
  id: number;
  name: string;
  slug: string;
  type: string;
  number_prefix?: string;
  is_active: boolean;
  is_system?: boolean;
  stages?: Array<{
    id: number;
    name: string;
    sequence: number;
    default_escalation_minutes: number | null;
    is_terminal: boolean;
  }>;
  statuses?: Array<{ id: number; name: string; slug: string; is_closed: boolean }>;
  priorities?: Array<{ id: number; name: string; slug: string; weight: number }>;
  severities?: Array<{ id: number; name: string; slug: string }>;
  categories?: Array<{ id: number; name: string; slug: string; parent_id?: number | null }>;
  procedures?: Array<{
    id: number;
    name: string;
    hook: string;
    stage_id: number | null;
    is_active: boolean;
    steps: unknown[];
  }>;
  sla_policies?: Array<{
    id: number;
    name: string;
    is_default: boolean;
    goals: unknown[];
  }>;
};

export type SdTicket = {
  id: number;
  desk_id: number;
  desk?: { id: number; name: string; slug: string; type: string } | null;
  number: string;
  summary: string;
  description?: string | null;
  stage_id?: number | null;
  stage?: { id: number; name: string; is_terminal?: boolean } | null;
  status_id?: number | null;
  status?: { id: number; name: string; slug: string } | null;
  priority_id?: number | null;
  priority?: { id: number; name: string; slug: string } | null;
  assignee_user_id?: number | null;
  assignee_pool?: string | null;
  escalation_level?: number;
  escalation_due_at?: string | null;
  sla_response_breached?: boolean;
  sla_resolve_breached?: boolean;
  archived_at?: string | null;
  is_unread?: boolean;
  pending_notification_at?: string | null;
  notes?: Array<{
    id: number;
    body: string;
    is_public: boolean;
    author_user_id?: number | null;
    created_at?: string;
  }>;
  tasks?: Array<{
    id: number;
    title: string;
    description?: string | null;
    hours_worked?: number | string;
    is_completed: boolean;
  }>;
  links?: Array<{
    id: number;
    related_type: string;
    related_id: number;
    link_type: string;
  }>;
  attachments?: Array<{
    id: number;
    original_name: string;
    mime?: string | null;
    size?: number;
  }>;
  created_at?: string;
};

export type SdKbArticle = {
  id: number;
  number?: string | null;
  summary: string;
  description?: string | null;
  is_published: boolean;
  source_ticket_id?: number | null;
};
