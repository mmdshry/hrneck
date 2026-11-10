"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { paginationQuery, parsePaginatedResponse } from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { ReportSchedulesPanel } from "./report-schedules-panel";
import {
  CampaignsSection,
  ChecklistsSection,
  CompanySection,
  TargetsSection,
  TicketingSection,
  TrainingSection,
  UsersSection,
} from "./report-sections";
import {
  REPORT_TABS,
  type CampaignSummary,
  type DetailedOverview,
  type OverviewBlocks,
  type ReportSharedFilters,
  type ReportTab,
  type StatusSegments,
} from "./report-types";

type ReportsPayload = {
  summary: CampaignSummary;
};

type DepartmentOption = {
  id: number;
  name: string;
};

function buildFilterParams(filters: ReportSharedFilters): string {
  const params = new URLSearchParams();
  if (filters.department_id) params.set("department_id", filters.department_id);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

function SegmentedBar({
  segments,
  ariaLabel,
}: {
  segments: StatusSegments;
  ariaLabel: string;
}) {
  const entries = Object.entries(segments).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) {
    return (
      <div
        className="mt-3 h-2 rounded-full bg-[var(--muted)]"
        role="img"
        aria-label={`${ariaLabel}: no data`}
      />
    );
  }

  const colors = [
    "var(--primary)",
    "var(--success)",
    "var(--muted-foreground)",
    "var(--destructive)",
    "var(--accent)",
  ];

  return (
    <div
      className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--muted)]"
      role="img"
      aria-label={ariaLabel}
    >
      {entries.map(([key, value], index) => (
        <div
          key={key}
          title={`${key.replaceAll("_", " ")}: ${value}`}
          style={{
            width: `${(value / total) * 100}%`,
            backgroundColor: colors[index % colors.length],
          }}
        />
      ))}
    </div>
  );
}

function OverviewBlock({
  title,
  primaryLabel,
  primaryValue,
  stats,
  segments,
  onOpen,
}: {
  title: string;
  primaryLabel: string;
  primaryValue: string | number;
  stats: Array<{ label: string; value: string | number }>;
  segments: StatusSegments;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-[var(--radius)] text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      <Panel className="h-full px-4 py-4 hover:border-[var(--primary)]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              {primaryLabel}
            </p>
            <p className="text-2xl font-medium tabular-nums">{primaryValue}</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs text-[var(--muted-foreground)]">{stat.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <SegmentedBar segments={segments} ariaLabel={`${title} status breakdown`} />
      </Panel>
    </button>
  );
}

export function ReportsClient() {
  const tenant = resolveTenant();
  const [tab, setTab] = useState<ReportTab>("overview");
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [blocks, setBlocks] = useState<OverviewBlocks | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const sharedFilters = useMemo<ReportSharedFilters>(
    () => ({
      department_id: departmentId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [departmentId, from, to],
  );

  const channel = useMemo(() => `org.${tenant}.reports`, [tenant]);

  const onPayload = useCallback((payload: ReportsPayload) => {
    if (!sharedFilters.department_id && !sharedFilters.from && !sharedFilters.to) {
      setSummary(payload.summary ?? null);
    }
  }, [sharedFilters.department_id, sharedFilters.from, sharedFilters.to]);

  const refreshOverview = useCallback(async () => {
    await ensureCsrf();
    const qs = buildFilterParams(sharedFilters);
    const res = await api<{ data: DetailedOverview }>(
      `/api/v1/org/reports/detailed${qs ? `?${qs}` : ""}`,
      { tenant: resolveTenant() },
    );
    setBlocks(res.data.blocks ?? null);
    setSummary(res.data.campaign ?? null);
  }, [sharedFilters]);

  const refreshSummary = useCallback(async () => {
    await ensureCsrf();
    const qs = buildFilterParams(sharedFilters);
    const res = await api<{ data: CampaignSummary }>(
      `/api/v1/org/reports/summary${qs ? `?${qs}` : ""}`,
      { tenant: resolveTenant() },
    );
    setSummary(res.data ?? null);
  }, [sharedFilters]);

  const { status, error } = useLiveTopic<ReportsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const res = await api(
          `/api/v1/org/departments?${paginationQuery(1, 500, { active_only: "1" })}`,
          { tenant: resolveTenant() },
        );
        const parsed = parsePaginatedResponse<DepartmentOption>(res, 500);
        setDepartments(
          parsed.data
            .map((d) => ({ id: d.id, name: d.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch {
        setDepartments([]);
      }
    })();
  }, []);

  useEffect(() => {
    void refreshSummary().catch(() => {
      /* overview may still populate */
    });
    void refreshOverview().catch((err: unknown) => {
      setOverviewError(err instanceof Error ? err.message : "Failed to load detailed reports");
    });
  }, [refreshOverview, refreshSummary]);

  const statusLabel = liveStatusLabel(status);

  function openTab(next: ReportTab) {
    setTab(next);
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Reports"
        description="Organization analytics across training, checklists, ticketing, and campaigns."
        actions={
          <span className="text-sm text-[var(--muted-foreground)]">
            {statusLabel ?? "Live"}
          </span>
        }
      />

      {error ? (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      ) : null}
      {overviewError ? (
        <Alert className="mt-4" variant="destructive">
          {overviewError}
        </Alert>
      ) : null}

      <Panel className="mt-6 grid gap-3 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-department">Department</Label>
          <select
            id="report-department"
            className="flex min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={String(dept.id)}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Panel>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Report sections">
        {REPORT_TABS.map((item) => (
          <Button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            variant={tab === item.id ? "default" : "secondary"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-8" role="tabpanel">
        {tab === "overview" ? (
          <div className="space-y-4">
            {!blocks ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {statusLabel ?? "Loading overview…"}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <OverviewBlock
                  title="Training"
                  primaryLabel="Completion rate"
                  primaryValue={`${blocks.training.completion_rate}%`}
                  stats={[
                    { label: "Assigned", value: blocks.training.assigned },
                    { label: "In progress", value: blocks.training.in_progress },
                    { label: "Completed", value: blocks.training.completed },
                    { label: "Total", value: blocks.training.total },
                  ]}
                  segments={blocks.training.segments}
                  onOpen={() => openTab("training")}
                />
                <OverviewBlock
                  title="Checklists"
                  primaryLabel="Completion rate"
                  primaryValue={`${blocks.checklists.completion_rate}%`}
                  stats={[
                    { label: "Open", value: blocks.checklists.open },
                    { label: "Completed", value: blocks.checklists.completed },
                    { label: "Total", value: blocks.checklists.total },
                  ]}
                  segments={blocks.checklists.segments}
                  onOpen={() => openTab("checklists")}
                />
                <OverviewBlock
                  title="Ticketing"
                  primaryLabel="Open"
                  primaryValue={blocks.ticketing.open}
                  stats={[
                    { label: "Resolved", value: blocks.ticketing.resolved },
                    {
                      label: "Response breach",
                      value: blocks.ticketing.sla_response_breached,
                    },
                    {
                      label: "Resolve breach",
                      value: blocks.ticketing.sla_resolve_breached,
                    },
                  ]}
                  segments={blocks.ticketing.segments}
                  onOpen={() => openTab("ticketing")}
                />
                <OverviewBlock
                  title="Campaigns / People"
                  primaryLabel="Complete rate"
                  primaryValue={`${blocks.campaigns_people.completed_pct}%`}
                  stats={[
                    {
                      label: "Running campaigns",
                      value: blocks.campaigns_people.campaigns_running,
                    },
                    { label: "Open rate", value: `${blocks.campaigns_people.opened_pct}%` },
                    {
                      label: "No-action rate",
                      value: `${blocks.campaigns_people.no_action_pct}%`,
                    },
                    {
                      label: "Active employees",
                      value: blocks.campaigns_people.active_employees,
                    },
                  ]}
                  segments={blocks.campaigns_people.segments}
                  onOpen={() => openTab("campaigns")}
                />
              </div>
            )}
            {summary && !blocks ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                Campaign complete rate {summary.completed_pct}% · Open {summary.opened_pct}% ·
                No-action {summary.no_action_pct}%
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "company" ? <CompanySection sharedFilters={sharedFilters} /> : null}
        {tab === "users" ? <UsersSection sharedFilters={sharedFilters} /> : null}
        {tab === "targets" ? <TargetsSection sharedFilters={sharedFilters} /> : null}
        {tab === "campaigns" ? <CampaignsSection sharedFilters={sharedFilters} /> : null}
        {tab === "training" ? <TrainingSection sharedFilters={sharedFilters} /> : null}
        {tab === "checklists" ? <ChecklistsSection sharedFilters={sharedFilters} /> : null}
        {tab === "ticketing" ? <TicketingSection sharedFilters={sharedFilters} /> : null}
      </div>

      <ReportSchedulesPanel />
    </div>
  );
}
