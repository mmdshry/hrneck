"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import { orgLiveChannel } from "@/lib/live-topics";
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
  ReportSharedFilters,
  TicketingSummary,
} from "./report-types";

function withSharedFilters(
  filters: Record<string, string | number | undefined>,
  shared?: ReportSharedFilters,
): Record<string, string | number | undefined> {
  return {
    ...filters,
    ...(shared?.department_id ? { department_id: shared.department_id } : {}),
    ...(shared?.from ? { from: shared.from } : {}),
    ...(shared?.to ? { to: shared.to } : {}),
  };
}

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
  const [liveEpoch, setLiveEpoch] = useState(0);
  const tenant = resolveTenant();
  const liveChannel = useMemo(
    () => (tenant ? orgLiveChannel(tenant, "reports-detailed") : null),
    [tenant],
  );

  const onLivePayload = useCallback(() => {
    setLiveEpoch((n) => n + 1);
  }, []);

  useLiveTopic({
    channel: liveChannel,
    enabled,
    onPayload: onLivePayload,
  });

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
  }, [load, liveEpoch]);

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

function useServerTableFilters() {
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  return { tableQuery, filters };
}

function CsvButton({ onCsv }: { onCsv: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onCsv}>
      Export CSV
    </Button>
  );
}

export function CompanySection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const [company, setCompany] = useState<CompanyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [liveEpoch, setLiveEpoch] = useState(0);
  const tenant = resolveTenant();
  const filterKey = JSON.stringify(sharedFilters ?? {});
  const liveChannel = useMemo(
    () => (tenant ? orgLiveChannel(tenant, "reports-detailed") : null),
    [tenant],
  );
  const onLivePayload = useCallback(() => {
    setLiveEpoch((n) => n + 1);
  }, []);

  useLiveTopic({
    channel: liveChannel,
    onPayload: onLivePayload,
  });

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const parsed = JSON.parse(filterKey) as ReportSharedFilters;
        const params = new URLSearchParams();
        if (parsed.department_id) params.set("department_id", parsed.department_id);
        if (parsed.from) params.set("from", parsed.from);
        if (parsed.to) params.set("to", parsed.to);
        const qs = params.toString();
        const res = await api<{ data: { data: CompanyPayload } }>(
          `/api/v1/org/reports/detailed/company${qs ? `?${qs}` : ""}`,
          { tenant: resolveTenant() },
        );
        setCompany(res.data.data as CompanyPayload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    })();
  }, [filterKey, liveEpoch]);

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
            void downloadReportCsv("company", withSharedFilters({}, sharedFilters)).catch(
              (err: unknown) =>
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
            { key: "targets", header: "Employees", cell: (r) => r.targets },
            { key: "sent", header: "Sent", cell: (r) => r.sent },
            { key: "opened", header: "Opened", cell: (r) => r.opened },
            { key: "completed", header: "Completed", cell: (r) => r.completed },
            { key: "opened_pct", header: "Open %", cell: (r) => r.opened_pct },
            { key: "completed_pct", header: "Complete %", cell: (r) => r.completed_pct },
            { key: "no_action_pct", header: "No-action %", cell: (r) => r.no_action_pct },
          ]}
        />
      </Panel>

      <Panel className="space-y-3 p-4">
        <h3 className="text-sm font-medium">By group</h3>
        <ReportTable
          rows={company.by_group}
          columns={[
            { key: "name", header: "Group", cell: (r) => r.name },
            { key: "targets", header: "Employees", cell: (r) => r.targets },
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

export function UsersSection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const { tableQuery, filters } = useServerTableFilters();
  const list = useReportSection<UserRow>("users", withSharedFilters(filters, sharedFilters));

  return (
    <SectionShell list={list}>
      <ReportTable
        mode="server"
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        loading={list.loading}
        pagination={{
          page: list.page,
          perPage: list.perPage,
          total: list.meta.total,
          onPageChange: list.setPage,
          onPerPageChange: (size) => {
            list.setPerPage(size);
            list.setPage(1);
          },
        }}
        toolbarExtra={<CsvButton onCsv={() => void list.onCsv()} />}
        rows={list.rows}
        columns={[
          { key: "name", header: "Name", cell: (r) => r.name, accessorKey: "name" },
          { key: "email", header: "Email", cell: (r) => r.email, accessorKey: "email" },
          {
            key: "roles",
            header: "Roles",
            cell: (r) => r.roles.join(", ") || "—",
            filterValue: (r) => r.roles,
          },
          {
            key: "mfa",
            header: "MFA",
            cell: (r) => (r.mfa_enabled ? "Yes" : "No"),
            filter: "select",
            filterOptions: [
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ],
            filterValue: (r) => (r.mfa_enabled ? "Yes" : "No"),
          },
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

export function TargetsSection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const { tableQuery, filters } = useServerTableFilters();
  const list = useReportSection<TargetRow>(
    "targets",
    withSharedFilters(filters, sharedFilters),
  );

  return (
    <SectionShell list={list}>
      <ReportTable
        mode="server"
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        loading={list.loading}
        pagination={{
          page: list.page,
          perPage: list.perPage,
          total: list.meta.total,
          onPageChange: list.setPage,
          onPerPageChange: (size) => {
            list.setPerPage(size);
            list.setPage(1);
          },
        }}
        toolbarExtra={<CsvButton onCsv={() => void list.onCsv()} />}
        rows={list.rows}
        columns={[
          { key: "email", header: "Email", cell: (r) => r.email, accessorKey: "email" },
          {
            key: "name",
            header: "Name",
            cell: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—",
            filterValue: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
          },
          {
            key: "department",
            header: "Department",
            cell: (r) => r.department ?? "—",
            accessorKey: "department",
          },
          {
            key: "groups",
            header: "Groups",
            cell: (r) => r.groups.join(", ") || "—",
            filterValue: (r) => r.groups,
          },
          { key: "status", header: "Status", cell: (r) => r.status, accessorKey: "status" },
          {
            key: "risk",
            header: "Risk",
            cell: (r) => r.risk_score,
            filterValue: (r) => r.risk_score,
          },
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
  completed: number;
  no_action: number;
  opened_pct: number;
  completed_pct: number;
  no_action_pct: number;
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
  completed: boolean;
};

export function CampaignsSection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const { tableQuery, filters } = useServerTableFilters();
  const recipientsQuery = useServerTableFilters();
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const campaigns = useReportSection<CampaignRow>(
    "campaigns",
    withSharedFilters(filters, sharedFilters),
  );
  const recipientFilters = withSharedFilters(
    {
      campaign_id: campaignId ?? undefined,
      ...recipientsQuery.filters,
    },
    sharedFilters,
  );
  const recipients = useReportSection<RecipientRow>(
    "recipients",
    recipientFilters,
    campaignId != null,
  );

  const campaignColumns: Array<ReportColumn<CampaignRow>> = [
    { key: "campaign", header: "Campaign", cell: (r) => r.name, filterValue: (r) => r.name },
    { key: "type", header: "Type", cell: (r) => r.type, accessorKey: "type" },
    { key: "status", header: "Status", cell: (r) => r.status, accessorKey: "status" },
    { key: "recipients", header: "Recipients", cell: (r) => r.recipients, filter: "none", enableSorting: true },
    { key: "sent", header: "Sent", cell: (r) => r.sent, filter: "none", enableSorting: true },
    { key: "opened", header: "Opened", cell: (r) => r.opened, filter: "none", enableSorting: true },
    { key: "completed", header: "Completed", cell: (r) => r.completed, filter: "none", enableSorting: true },
    { key: "opened_pct", header: "Open %", cell: (r) => r.opened_pct, filter: "none", enableSorting: true },
    { key: "completed_pct", header: "Complete %", cell: (r) => r.completed_pct, filter: "none", enableSorting: true },
    { key: "no_action_pct", header: "No-action %", cell: (r) => r.no_action_pct, filter: "none", enableSorting: true },
  ];

  return (
    <div className="space-y-6">
      <SectionShell list={campaigns}>
        <ReportTable
          mode="server"
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          loading={campaigns.loading}
          pagination={{
            page: campaigns.page,
            perPage: campaigns.perPage,
            total: campaigns.meta.total,
            onPageChange: campaigns.setPage,
            onPerPageChange: (size) => {
              campaigns.setPerPage(size);
              campaigns.setPage(1);
            },
          }}
          toolbarExtra={<CsvButton onCsv={() => void campaigns.onCsv()} />}
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
              <CsvButton onCsv={() => void recipients.onCsv()} />
              <Button type="button" variant="secondary" onClick={() => setCampaignId(null)}>
                Close
              </Button>
            </div>
          </div>
          <SectionShell list={recipients}>
            <ReportTable
              mode="server"
              filterState={recipientsQuery.tableQuery.state}
              onFilterStateChange={recipientsQuery.tableQuery.setState}
              loading={recipients.loading}
              pagination={{
                page: recipients.page,
                perPage: recipients.perPage,
                total: recipients.meta.total,
                onPageChange: recipients.setPage,
                onPerPageChange: (size) => {
                  recipients.setPerPage(size);
                  recipients.setPage(1);
                },
              }}
              rows={recipients.rows}
              columns={[
                { key: "email", header: "Email", cell: (r) => r.email ?? "—", accessorKey: "email" },
                { key: "name", header: "Name", cell: (r) => r.name || "—", accessorKey: "name" },
                {
                  key: "department",
                  header: "Department",
                  cell: (r) => r.department ?? "—",
                  accessorKey: "department",
                },
                { key: "status", header: "Status", cell: (r) => r.status, accessorKey: "status" },
                {
                  key: "sent_at",
                  header: "Sent",
                  cell: (r) => (r.sent_at ? "Yes" : "—"),
                  filter: "none",
                },
                {
                  key: "opened_at",
                  header: "Opened",
                  cell: (r) => (r.opened_at ? "Yes" : "—"),
                  filter: "none",
                },
                {
                  key: "completed",
                  header: "Completed",
                  cell: (r) => (r.completed ? "Yes" : "—"),
                  filter: "none",
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

export function TrainingSection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const { tableQuery, filters } = useServerTableFilters();
  const list = useReportSection<TrainingRow>(
    "training",
    withSharedFilters(filters, sharedFilters),
  );

  return (
    <SectionShell list={list}>
      <ReportTable
        mode="server"
        filterState={tableQuery.state}
        onFilterStateChange={tableQuery.setState}
        loading={list.loading}
        pagination={{
          page: list.page,
          perPage: list.perPage,
          total: list.meta.total,
          onPageChange: list.setPage,
          onPerPageChange: (size) => {
            list.setPerPage(size);
            list.setPage(1);
          },
        }}
        toolbarExtra={<CsvButton onCsv={() => void list.onCsv()} />}
        rows={list.rows}
        columns={[
          { key: "email", header: "Email", cell: (r) => r.email ?? "—", accessorKey: "email" },
          { key: "name", header: "Name", cell: (r) => r.name || "—", accessorKey: "name" },
          {
            key: "department",
            header: "Department",
            cell: (r) => r.department ?? "—",
            accessorKey: "department",
          },
          { key: "course", header: "Course", cell: (r) => r.course ?? "—", accessorKey: "course" },
          { key: "status", header: "Status", cell: (r) => r.status, accessorKey: "status" },
          {
            key: "progress",
            header: "Progress",
            cell: (r) => `${r.progress}%`,
            filterValue: (r) => r.progress,
          },
          { key: "source", header: "Source", cell: (r) => r.source, accessorKey: "source" },
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

const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  custom: "Custom",
  hr_ops: "HR ops",
  offboarding: "Offboarding",
  onboarding: "Onboarding",
};

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function humanizeKey(key: string): string {
  const spaced = key.replaceAll("_", " ");
  return spaced.length > 0
    ? spaced.charAt(0).toUpperCase() + spaced.slice(1)
    : spaced;
}

function checklistCategoryLabel(key: string): string {
  return CHECKLIST_CATEGORY_LABELS[key] ?? humanizeKey(key);
}

function checklistStatusLabel(key: string): string {
  return CHECKLIST_STATUS_LABELS[key] ?? humanizeKey(key);
}

function checklistStatusBarColor(key: string): string {
  switch (key) {
    case "completed":
      return "var(--success)";
    case "in_progress":
      return "var(--primary)";
    case "not_started":
      return "var(--muted-foreground)";
    case "cancelled":
      return "var(--destructive)";
    default:
      return "var(--primary)";
  }
}

function BreakdownPanel({
  title,
  counts,
  emptyLabel,
  labelFor,
  barColorFor,
}: {
  title: string;
  counts: Record<string, number>;
  emptyLabel: string;
  labelFor: (key: string) => string;
  barColorFor: (key: string) => string;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <Panel className="p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {entries.map(([key, value]) => {
            const label = labelFor(key);
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <li key={key}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-[var(--muted-foreground)]">{label}</span>
                  <span className="text-base font-medium tabular-nums">{value}</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label}: ${value} of ${total}`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, pct))}%`,
                      backgroundColor: barColorFor(key),
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function ChecklistsSection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const { tableQuery, filters } = useServerTableFilters();
  const list = useReportSection<ChecklistRow>(
    "checklists",
    withSharedFilters(filters, sharedFilters),
  );
  const byCategory = (list.summary?.by_category ?? {}) as Record<string, number>;
  const byStatus = (list.summary?.by_status ?? {}) as Record<string, number>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <BreakdownPanel
          title="By category"
          counts={byCategory}
          emptyLabel="No templates."
          labelFor={checklistCategoryLabel}
          barColorFor={() => "var(--primary)"}
        />
        <BreakdownPanel
          title="By status"
          counts={byStatus}
          emptyLabel="No instances."
          labelFor={checklistStatusLabel}
          barColorFor={checklistStatusBarColor}
        />
      </div>
      <SectionShell list={list}>
        <ReportTable
          mode="server"
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          loading={list.loading}
          pagination={{
            page: list.page,
            perPage: list.perPage,
            total: list.meta.total,
            onPageChange: list.setPage,
            onPerPageChange: (size) => {
              list.setPerPage(size);
              list.setPage(1);
            },
          }}
          toolbarExtra={<CsvButton onCsv={() => void list.onCsv()} />}
          rows={list.rows}
          columns={[
            { key: "title", header: "Title", cell: (r) => r.title, accessorKey: "title" },
            {
              key: "template",
              header: "Template",
              cell: (r) => r.template ?? "—",
              accessorKey: "template",
            },
            {
              key: "category",
              header: "Category",
              cell: (r) => r.category ?? "—",
              accessorKey: "category",
            },
            {
              key: "assignee",
              header: "Assignee",
              cell: (r) => r.email ?? "—",
              filterValue: (r) => r.email,
            },
            { key: "status", header: "Status", cell: (r) => r.status, accessorKey: "status" },
            {
              key: "progress",
              header: "Progress",
              cell: (r) => `${r.progress_pct}%`,
              filterValue: (r) => r.progress_pct,
            },
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

export function TicketingSection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const { tableQuery, filters } = useServerTableFilters();
  const list = useReportSection<TicketRow>(
    "ticketing",
    withSharedFilters(filters, sharedFilters),
  );
  const summary = list.summary as TicketingSummary | undefined;

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="space-y-4">
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
          <div className="grid gap-3 lg:grid-cols-3">
            <BreakdownPanel
              title="By desk"
              counts={summary.by_desk ?? {}}
              emptyLabel="No desks."
              labelFor={humanizeKey}
              barColorFor={() => "var(--primary)"}
            />
            <BreakdownPanel
              title="By priority"
              counts={summary.by_priority ?? {}}
              emptyLabel="No priorities."
              labelFor={humanizeKey}
              barColorFor={() => "var(--primary)"}
            />
            <BreakdownPanel
              title="By stage"
              counts={summary.by_stage ?? {}}
              emptyLabel="No stages."
              labelFor={humanizeKey}
              barColorFor={() => "var(--primary)"}
            />
          </div>
        </div>
      ) : null}
      <SectionShell list={list}>
        <ReportTable
          mode="server"
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          loading={list.loading}
          pagination={{
            page: list.page,
            perPage: list.perPage,
            total: list.meta.total,
            onPageChange: list.setPage,
            onPerPageChange: (size) => {
              list.setPerPage(size);
              list.setPage(1);
            },
          }}
          toolbarExtra={<CsvButton onCsv={() => void list.onCsv()} />}
          rows={list.rows}
          columns={[
            { key: "number", header: "Number", cell: (r) => r.number, accessorKey: "number" },
            { key: "summary", header: "Summary", cell: (r) => r.summary, accessorKey: "summary" },
            { key: "desk", header: "Desk", cell: (r) => r.desk ?? "—", accessorKey: "desk" },
            { key: "stage", header: "Stage", cell: (r) => r.stage ?? "—", accessorKey: "stage" },
            {
              key: "priority",
              header: "Priority",
              cell: (r) => r.priority ?? "—",
              accessorKey: "priority",
            },
            { key: "status", header: "Status", cell: (r) => r.status ?? "—", accessorKey: "status" },
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
              filterValue: (r) =>
                r.sla_response_breached || r.sla_resolve_breached ? "breach" : "ok",
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
}: {
  list: ReturnType<typeof useReportSection<T>>;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      {list.error ? <Alert variant="destructive">{list.error}</Alert> : null}
      {list.csvError ? <Alert variant="destructive">{list.csvError}</Alert> : null}
      {children}
    </div>
  );
}
