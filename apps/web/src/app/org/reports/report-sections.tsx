"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  type PageSize,
  paginationQuery,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { downloadReportCsv } from "./download-report-csv";
import { ReportTable, type ReportColumn } from "./report-table";
import type {
  CompanyPayload,
  PaginationMeta,
  ReportSection,
  TicketingSummary,
} from "./report-types";

type ListState<T> = {
  rows: T[];
  meta: PaginationMeta;
  summary?: Record<string, unknown>;
};

const emptyMeta = (perPage: number): PaginationMeta => ({
  current_page: 1,
  last_page: 1,
  per_page: perPage,
  total: 0,
});

function useReportSection<T>(
  section: ReportSection,
  filters: Record<string, string | number | undefined>,
  enabled = true,
) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [state, setState] = useState<ListState<T>>({
    rows: [],
    meta: emptyMeta(DEFAULT_PAGE_SIZE),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    setPage(1);
  }, [filterKey, section]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      await ensureCsrf();
      const parsed = JSON.parse(filterKey) as Record<
        string,
        string | number | undefined
      >;
      const qs = paginationQuery(page, perPage, parsed);
      const res = await api<{
        data: {
          data?: T[] | CompanyPayload;
          meta?: PaginationMeta;
          summary?: Record<string, unknown>;
        };
      }>(`/api/v1/org/reports/detailed/${section}?${qs}`, {
        tenant: resolveTenant(),
      });
      const payload = res.data;
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setState({
        rows: rows as T[],
        meta: payload.meta ?? emptyMeta(perPage),
        summary: payload.summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [enabled, filterKey, page, perPage, section]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCsv() {
    setCsvError(null);
    try {
      const parsed = JSON.parse(filterKey) as Record<
        string,
        string | number | undefined
      >;
      await downloadReportCsv(section, parsed);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "CSV export failed");
    }
  }

  return {
    ...state,
    page,
    perPage,
    loading,
    error,
    csvError,
    setPage,
    setPerPage,
    onCsv,
    reload: load,
  };
}

function SectionToolbar({
  q,
  onQ,
  onCsv,
  children,
}: {
  q: string;
  onQ: (value: string) => void;
  onCsv: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="report-q" className="text-[var(--muted-foreground)]">
            Search
          </Label>
          <Input
            id="report-q"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Search…"
            className="w-56"
          />
        </div>
        {children}
      </div>
      <Button type="button" variant="outline" onClick={onCsv}>
        Export CSV
      </Button>
    </div>
  );
}

export function CompanySection() {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const res = await api<{ data: { data: CompanyPayload } }>(
          "/api/v1/org/reports/detailed/company",
          { tenant: resolveTenant() },
        );
        setCompany(res.data.data as CompanyPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
  }, []);

  if (error) return <Alert variant="destructive">{error}</Alert>;
  if (!company) {
    return <p className="text-sm text-[var(--muted-foreground)]">Loading company…</p>;
  }

  const profileEntries = Object.entries(company.profile).filter(([, v]) => v != null && v !== "");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void downloadReportCsv("company").catch((err: unknown) =>
              setCsvError(err instanceof Error ? err.message : "CSV export failed"),
            );
          }}
        >
          Export CSV
        </Button>
      </div>
      {csvError ? <Alert variant="destructive">{csvError}</Alert> : null}
      <Panel className="p-4">
        <h3 className="text-sm font-medium">Organization profile</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profileEntries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {key.replaceAll("_", " ")}
              </dt>
              <dd className="mt-1 text-sm">{String(value)}</dd>
            </div>
          ))}
          {profileEntries.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No profile fields set.</p>
          ) : null}
        </dl>
      </Panel>

      <Panel className="space-y-3 p-4">
        <h3 className="text-sm font-medium">By department</h3>
        <ReportTable
          rows={company.by_department}
          columns={[
            { key: "department", header: "Department", cell: (r) => r.department },
            { key: "targets", header: "People", cell: (r) => r.targets },
            { key: "sent", header: "Sent", cell: (r) => r.sent },
            { key: "opened", header: "Opened", cell: (r) => r.opened },
            { key: "clicked", header: "Clicked", cell: (r) => r.clicked },
            { key: "click_rate", header: "Click %", cell: (r) => r.click_rate },
          ]}
        />
      </Panel>

      <Panel className="space-y-3 p-4">
        <h3 className="text-sm font-medium">By group</h3>
        <ReportTable
          rows={company.by_group}
          columns={[
            { key: "name", header: "Group", cell: (r) => r.name },
            { key: "targets", header: "People", cell: (r) => r.targets },
            { key: "source", header: "Source", cell: (r) => r.source ?? "—" },
          ]}
        />
      </Panel>

      <Panel className="space-y-3 p-4">
        <h3 className="text-sm font-medium">By role</h3>
        <ReportTable
          rows={company.by_role}
          columns={[
            { key: "role", header: "Role", cell: (r) => r.role },
            { key: "users", header: "Users", cell: (r) => r.users },
          ]}
        />
      </Panel>
    </div>
  );
}

type UserRow = {
  id: number;
  name: string;
  email: string;
  roles: string[];
  mfa_enabled: boolean;
};

export function UsersSection() {
  const [q, setQ] = useState("");
  const filters = { q: q.trim() || undefined };
  const list = useReportSection<UserRow>("users", filters);

  return (
    <SectionShell list={list}>
      <SectionToolbar q={q} onQ={setQ} onCsv={() => void list.onCsv()} />
      <ReportTable
        rows={list.rows}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name },
          { key: "email", header: "Email", cell: (r) => r.email },
          { key: "roles", header: "Roles", cell: (r) => r.roles.join(", ") || "—" },
          { key: "mfa", header: "MFA", cell: (r) => (r.mfa_enabled ? "Yes" : "No") },
        ]}
      />
    </SectionShell>
  );
}

type TargetRow = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  status: string;
  risk_score: number;
  groups: string[];
};

export function TargetsSection() {
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("");
  const filters = {
    q: q.trim() || undefined,
    department: department.trim() || undefined,
  };
  const list = useReportSection<TargetRow>("targets", filters);

  return (
    <SectionShell list={list}>
      <SectionToolbar q={q} onQ={setQ} onCsv={() => void list.onCsv()}>
        <div className="space-y-1">
          <Label htmlFor="report-dept" className="text-[var(--muted-foreground)]">
            Department
          </Label>
          <Input
            id="report-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Filter department"
            className="w-48"
          />
        </div>
      </SectionToolbar>
      <ReportTable
        rows={list.rows}
        columns={[
          { key: "email", header: "Email", cell: (r) => r.email },
          {
            key: "name",
            header: "Name",
            cell: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—",
          },
          { key: "department", header: "Department", cell: (r) => r.department ?? "—" },
          { key: "groups", header: "Groups", cell: (r) => r.groups.join(", ") || "—" },
          { key: "status", header: "Status", cell: (r) => r.status },
          { key: "risk", header: "Risk", cell: (r) => r.risk_score },
        ]}
      />
    </SectionShell>
  );
}

type CampaignRow = {
  id: number;
  name: string;
  type: string;
  status: string;
  course: string | null;
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  submitted: number;
  reported: number;
  click_rate: number;
};

type RecipientRow = {
  id: number;
  campaign_id: number;
  campaign_name: string | null;
  email: string | null;
  name: string;
  department: string | null;
  status: string;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  submitted_at: string | null;
  reported_at: string | null;
};

export function CampaignsSection() {
  const [q, setQ] = useState("");
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const campaignFilters = { q: q.trim() || undefined };
  const campaigns = useReportSection<CampaignRow>("campaigns", campaignFilters);
  const recipientFilters = { campaign_id: campaignId ?? undefined };
  const recipients = useReportSection<RecipientRow>(
    "recipients",
    recipientFilters,
    campaignId != null,
  );

  const campaignColumns: Array<ReportColumn<CampaignRow>> = [
    { key: "name", header: "Campaign", cell: (r) => r.name },
    { key: "type", header: "Type", cell: (r) => r.type },
    { key: "status", header: "Status", cell: (r) => r.status },
    { key: "recipients", header: "Recipients", cell: (r) => r.recipients },
    { key: "sent", header: "Sent", cell: (r) => r.sent },
    { key: "opened", header: "Opened", cell: (r) => r.opened },
    { key: "clicked", header: "Clicked", cell: (r) => r.clicked },
    { key: "click_rate", header: "Click %", cell: (r) => r.click_rate },
  ];

  return (
    <div className="space-y-6">
      <SectionShell list={campaigns}>
        <SectionToolbar q={q} onQ={setQ} onCsv={() => void campaigns.onCsv()} />
        <ReportTable
          rows={campaigns.rows}
          columns={campaignColumns}
          onRowClick={(row) => setCampaignId(row.id)}
        />
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          Click a campaign to drill into recipients.
        </p>
      </SectionShell>

      {campaignId != null ? (
        <Panel className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              Recipients for campaign #{campaignId}
            </h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void recipients.onCsv()}>
                Export CSV
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCampaignId(null)}>
                Close
              </Button>
            </div>
          </div>
          <SectionShell list={recipients} hidePagination={false}>
            <ReportTable
              rows={recipients.rows}
              columns={[
                { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
                { key: "name", header: "Name", cell: (r) => r.name || "—" },
                { key: "department", header: "Department", cell: (r) => r.department ?? "—" },
                { key: "status", header: "Status", cell: (r) => r.status },
                {
                  key: "sent_at",
                  header: "Sent",
                  cell: (r) => (r.sent_at ? "Yes" : "—"),
                },
                {
                  key: "opened_at",
                  header: "Opened",
                  cell: (r) => (r.opened_at ? "Yes" : "—"),
                },
                {
                  key: "clicked_at",
                  header: "Clicked",
                  cell: (r) => (r.clicked_at ? "Yes" : "—"),
                },
                {
                  key: "submitted_at",
                  header: "Submitted",
                  cell: (r) => (r.submitted_at ? "Yes" : "—"),
                },
                {
                  key: "reported_at",
                  header: "Reported",
                  cell: (r) => (r.reported_at ? "Yes" : "—"),
                },
              ]}
            />
          </SectionShell>
        </Panel>
      ) : null}
    </div>
  );
}

type TrainingRow = {
  id: number;
  email: string | null;
  name: string;
  department: string | null;
  course: string | null;
  status: string;
  progress: number;
  opened_at: string | null;
  completed_at: string | null;
  source: string;
};

export function TrainingSection() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const filters = {
    q: q.trim() || undefined,
    status: status.trim() || undefined,
  };
  const list = useReportSection<TrainingRow>("training", filters);

  return (
    <SectionShell list={list}>
      <SectionToolbar q={q} onQ={setQ} onCsv={() => void list.onCsv()}>
        <div className="space-y-1">
          <Label htmlFor="report-training-status" className="text-[var(--muted-foreground)]">
            Status
          </Label>
          <Input
            id="report-training-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="e.g. completed"
            className="w-40"
          />
        </div>
      </SectionToolbar>
      <ReportTable
        rows={list.rows}
        columns={[
          { key: "email", header: "Email", cell: (r) => r.email ?? "—" },
          { key: "name", header: "Name", cell: (r) => r.name || "—" },
          { key: "department", header: "Department", cell: (r) => r.department ?? "—" },
          { key: "course", header: "Course", cell: (r) => r.course ?? "—" },
          { key: "status", header: "Status", cell: (r) => r.status },
          { key: "progress", header: "Progress", cell: (r) => `${r.progress}%` },
          { key: "source", header: "Source", cell: (r) => r.source },
        ]}
      />
    </SectionShell>
  );
}

type ChecklistRow = {
  id: number;
  title: string;
  template: string | null;
  category: string | null;
  email: string | null;
  name: string;
  status: string;
  progress_pct: number;
};

export function ChecklistsSection() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const filters = {
    q: q.trim() || undefined,
    status: status.trim() || undefined,
  };
  const list = useReportSection<ChecklistRow>("checklists", filters);
  const byCategory = (list.summary?.by_category ?? {}) as Record<string, number>;
  const byStatus = (list.summary?.by_status ?? {}) as Record<string, number>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel className="p-4">
          <h3 className="text-sm font-medium">By category</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(byCategory).map(([key, value]) => (
              <li key={key} className="flex justify-between gap-2">
                <span>{key}</span>
                <span className="font-medium">{value}</span>
              </li>
            ))}
            {Object.keys(byCategory).length === 0 ? (
              <li className="text-[var(--muted-foreground)]">No templates.</li>
            ) : null}
          </ul>
        </Panel>
        <Panel className="p-4">
          <h3 className="text-sm font-medium">By status</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(byStatus).map(([key, value]) => (
              <li key={key} className="flex justify-between gap-2">
                <span>{key}</span>
                <span className="font-medium">{value}</span>
              </li>
            ))}
            {Object.keys(byStatus).length === 0 ? (
              <li className="text-[var(--muted-foreground)]">No instances.</li>
            ) : null}
          </ul>
        </Panel>
      </div>
      <SectionShell list={list}>
        <SectionToolbar q={q} onQ={setQ} onCsv={() => void list.onCsv()}>
          <div className="space-y-1">
            <Label htmlFor="report-checklist-status" className="text-[var(--muted-foreground)]">
              Status
            </Label>
            <Input
              id="report-checklist-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="e.g. completed"
              className="w-40"
            />
          </div>
        </SectionToolbar>
        <ReportTable
          rows={list.rows}
          columns={[
            { key: "title", header: "Title", cell: (r) => r.title },
            { key: "template", header: "Template", cell: (r) => r.template ?? "—" },
            { key: "category", header: "Category", cell: (r) => r.category ?? "—" },
            { key: "email", header: "Assignee", cell: (r) => r.email ?? "—" },
            { key: "status", header: "Status", cell: (r) => r.status },
            { key: "progress", header: "Progress", cell: (r) => `${r.progress_pct}%` },
          ]}
        />
      </SectionShell>
    </div>
  );
}

type TicketRow = {
  id: number;
  number: string;
  summary: string;
  desk: string | null;
  stage: string | null;
  priority: string | null;
  status: string | null;
  sla_response_breached: boolean;
  sla_resolve_breached: boolean;
};

export function TicketingSection() {
  const [q, setQ] = useState("");
  const filters = { q: q.trim() || undefined };
  const list = useReportSection<TicketRow>("ticketing", filters);
  const summary = list.summary as TicketingSummary | undefined;

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Panel className="px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Open</p>
            <p className="mt-1 text-2xl font-medium">{summary.total_open}</p>
          </Panel>
          <Panel className="px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Resolved</p>
            <p className="mt-1 text-2xl font-medium">{summary.total_resolved}</p>
          </Panel>
          <Panel className="px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              Response breach
            </p>
            <p className="mt-1 text-2xl font-medium">{summary.sla_response_breached}</p>
          </Panel>
          <Panel className="px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              Resolve breach
            </p>
            <p className="mt-1 text-2xl font-medium">{summary.sla_resolve_breached}</p>
          </Panel>
        </div>
      ) : null}
      <SectionShell list={list}>
        <SectionToolbar q={q} onQ={setQ} onCsv={() => void list.onCsv()} />
        <ReportTable
          rows={list.rows}
          columns={[
            { key: "number", header: "Number", cell: (r) => r.number },
            { key: "summary", header: "Summary", cell: (r) => r.summary },
            { key: "desk", header: "Desk", cell: (r) => r.desk ?? "—" },
            { key: "stage", header: "Stage", cell: (r) => r.stage ?? "—" },
            { key: "priority", header: "Priority", cell: (r) => r.priority ?? "—" },
            { key: "status", header: "Status", cell: (r) => r.status ?? "—" },
            {
              key: "sla",
              header: "SLA",
              cell: (r) =>
                [
                  r.sla_response_breached ? "response" : null,
                  r.sla_resolve_breached ? "resolve" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "OK",
            },
          ]}
        />
      </SectionShell>
    </div>
  );
}

function SectionShell<T>({
  list,
  children,
  hidePagination = false,
}: {
  list: ReturnType<typeof useReportSection<T>>;
  children: ReactNode;
  hidePagination?: boolean;
}) {
  return (
    <div className="space-y-3">
      {list.error ? <Alert variant="destructive">{list.error}</Alert> : null}
      {list.csvError ? <Alert variant="destructive">{list.csvError}</Alert> : null}
      {list.loading ? (
        <MinimalLoader className="min-h-16 py-4" />
      ) : null}
      {children}
      {!hidePagination ? (
        <Pagination
          page={list.page}
          perPage={list.perPage}
          total={list.meta.total}
          onPageChange={list.setPage}
          onPerPageChange={(size) => {
            list.setPerPage(size);
            list.setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
