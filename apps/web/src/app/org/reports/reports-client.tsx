"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { paginationQuery, parsePaginatedResponse } from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import { filterSupportForTab, sharedFiltersForTab } from "./report-filter-support";
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
  const t = useTranslations("org.reports");
  const entries = Object.entries(segments).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) {
    return (
      <div
        className="mt-3 h-2 rounded-full bg-[var(--muted)]"
        role="img"
        aria-label={`${ariaLabel}: ${t("noData")}`}
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
  const t = useTranslations("org.reports");
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
        <SegmentedBar segments={segments} ariaLabel={t("statusBreakdown", { title })} />
      </Panel>
    </button>
  );
}

export function ReportsClient() {
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const [tab, setTab] = useState<ReportTab>("overview");
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [blocks, setBlocks] = useState<OverviewBlocks | null>(null);
  const [counts, setCounts] = useState<DetailedOverview["counts"] | null>(null);
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

  const tabFilters = useMemo(() => sharedFiltersForTab(tab, sharedFilters), [tab, sharedFilters]);
  const tabSupport = filterSupportForTab(tab);

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
    setCounts(res.data.counts ?? null);
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
    if (error) {
      toastError(error);
    }
  }, [error]);

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
      toastError(err instanceof Error ? err.message : t("failedDetailed"));
    });
  }, [refreshOverview, refreshSummary, t]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  const reportTabs = useMemo(
    () =>
      REPORT_TABS.map((id) => ({
        id,
        label:
          id === "overview"
            ? t("overview")
            : id === "company"
              ? t("company")
              : id === "users"
                ? tCommon("users")
                : id === "targets"
                  ? tCommon("employees")
                  : id === "campaigns"
                    ? t("campaigns")
                    : id === "training"
                      ? t("training")
                      : id === "checklists"
                        ? t("checklists")
                        : t("ticketing"),
      })),
    [t, tCommon],
  );

  function openTab(next: ReportTab) {
    setTab(next);
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <span className="text-sm text-[var(--muted-foreground)]">
            {statusLabel ?? tCommon("live")}
          </span>
        }
      />

      <Panel className="mt-6 grid gap-3 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-department">{tCommon("department")}</Label>
          <select
            id="report-department"
            className="flex min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">{t("allDepartments")}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={String(dept.id)}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        {tabSupport.dateRange ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="report-from">{tCommon("from")}</Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to">{tCommon("to")}</Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </>
        ) : (
          <p className="self-end text-sm text-[var(--muted-foreground)] sm:col-span-2">
            {t("dateRangeNotApplicable")}
          </p>
        )}
      </Panel>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label={t("reportSections")}>
        {reportTabs.map((item) => (
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
            {counts ? (
              <Panel className="p-4">
                <h3 className="text-sm font-medium">{t("totalsTitle")}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: tCommon("users"), value: counts.users },
                    { label: tCommon("employees"), value: counts.targets },
                    { label: tCommon("groups"), value: counts.groups },
                    { label: t("campaigns"), value: counts.campaigns },
                    { label: t("enrollments"), value: counts.enrollments },
                    { label: t("checklistTemplates"), value: counts.checklist_templates },
                    { label: t("checklistInstances"), value: counts.checklist_instances },
                    { label: t("ticketsOpen"), value: counts.tickets_open },
                    { label: t("ticketsResolved"), value: counts.tickets_resolved },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <dt className="text-xs text-[var(--muted-foreground)]">{stat.label}</dt>
                      <dd className="text-lg font-medium tabular-nums">{stat.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            ) : null}
            {!blocks ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {statusLabel ?? tCommon("loadingOverview")}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <OverviewBlock
                  title={t("training")}
                  primaryLabel={tCommon("completionRate")}
                  primaryValue={`${blocks.training.completion_rate}%`}
                  stats={[
                    { label: tCommon("assigned"), value: blocks.training.assigned },
                    { label: tCommon("inProgress"), value: blocks.training.in_progress },
                    { label: tCommon("completed"), value: blocks.training.completed },
                    { label: tCommon("total"), value: blocks.training.total },
                  ]}
                  segments={blocks.training.segments}
                  onOpen={() => openTab("training")}
                />
                <OverviewBlock
                  title={t("checklists")}
                  primaryLabel={tCommon("completionRate")}
                  primaryValue={`${blocks.checklists.completion_rate}%`}
                  stats={[
                    { label: tCommon("open"), value: blocks.checklists.open },
                    { label: tCommon("completed"), value: blocks.checklists.completed },
                    { label: tCommon("cancelled"), value: blocks.checklists.cancelled },
                    { label: tCommon("total"), value: blocks.checklists.total },
                  ]}
                  segments={blocks.checklists.segments}
                  onOpen={() => openTab("checklists")}
                />
                <OverviewBlock
                  title={t("ticketing")}
                  primaryLabel={tCommon("open")}
                  primaryValue={blocks.ticketing.open}
                  stats={[
                    { label: tCommon("resolved"), value: blocks.ticketing.resolved },
                    {
                      label: t("responseBreach"),
                      value: blocks.ticketing.sla_response_breached,
                    },
                    {
                      label: t("resolveBreach"),
                      value: blocks.ticketing.sla_resolve_breached,
                    },
                  ]}
                  segments={blocks.ticketing.segments}
                  onOpen={() => openTab("ticketing")}
                />
                <OverviewBlock
                  title={t("campaignsPeople")}
                  primaryLabel={tCommon("completeRate")}
                  primaryValue={`${blocks.campaigns_people.completed_pct}%`}
                  stats={[
                    {
                      label: t("runningCampaigns"),
                      value: blocks.campaigns_people.campaigns_running,
                    },
                    { label: t("openRate"), value: `${blocks.campaigns_people.opened_pct}%` },
                    {
                      label: t("noActionRate"),
                      value: `${blocks.campaigns_people.no_action_pct}%`,
                    },
                    {
                      label: t("activeEmployees"),
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
                {t("campaignSummaryLine", {
                  completed: summary.completed_pct,
                  opened: summary.opened_pct,
                  noAction: summary.no_action_pct,
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "company" ? <CompanySection sharedFilters={tabFilters} /> : null}
        {tab === "users" ? <UsersSection sharedFilters={tabFilters} /> : null}
        {tab === "targets" ? <TargetsSection sharedFilters={tabFilters} /> : null}
        {tab === "campaigns" ? <CampaignsSection sharedFilters={tabFilters} /> : null}
        {tab === "training" ? <TrainingSection sharedFilters={tabFilters} /> : null}
        {tab === "checklists" ? <ChecklistsSection sharedFilters={tabFilters} /> : null}
        {tab === "ticketing" ? <TicketingSection sharedFilters={tabFilters} /> : null}
      </div>

      <ReportSchedulesPanel />
    </div>
  );
}
