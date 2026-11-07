"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import {
  CampaignsSection,
  ChecklistsSection,
  CompanySection,
  TargetsSection,
  TicketingSection,
  TrainingSection,
  UsersSection,
} from "./report-sections";
import { REPORT_TABS, type DetailedOverview, type ReportTab } from "./report-types";

const Chart = dynamic(
  () => import("./report-chart").then((m) => m.ReportChart),
  {
    ssr: false,
    loading: () => <MinimalLoader />,
  },
);

type ReportsPayload = {
  summary: Record<string, number>;
};

export function ReportsClient() {
  const tenant = resolveTenant();
  const [tab, setTab] = useState<ReportTab>("overview");
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [overview, setOverview] = useState<DetailedOverview | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const channel = useMemo(() => `org.${tenant}.reports`, [tenant]);

  const onPayload = useCallback((payload: ReportsPayload) => {
    setSummary(payload.summary ?? {});
    setShowChart(true);
  }, []);

  const refreshSummary = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: Record<string, number> }>(
      "/api/v1/org/reports/summary",
      { tenant: resolveTenant() },
    );
    setSummary(res.data ?? {});
    setShowChart(true);
  }, []);

  const refreshOverview = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: DetailedOverview }>(
      "/api/v1/org/reports/detailed",
      { tenant: resolveTenant() },
    );
    setOverview(res.data);
    if (res.data.campaign) {
      setSummary(res.data.campaign);
      setShowChart(true);
    }
  }, []);

  const { status, error } = useLiveTopic<ReportsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void refreshSummary().catch(() => {
      /* live channel may still populate */
    });
    void refreshOverview().catch((err: unknown) => {
      setOverviewError(err instanceof Error ? err.message : "Failed to load detailed reports");
    });
  }, [refreshOverview, refreshSummary]);

  const statusLabel = liveStatusLabel(status);
  const counts = overview?.counts;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Reports"
        description="Detailed organization analytics across company, people, campaigns, training, checklists, and ticketing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--muted-foreground)]">
              {statusLabel ?? "Live"}
            </span>
            <Button type="button" variant="secondary" onClick={() => setShowChart(true)}>
              Show chart
            </Button>
          </div>
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
          <div className="space-y-8">
            {Object.keys(summary).length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {statusLabel ?? "Waiting for live report data…"}
              </p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Object.entries(summary).map(([key, value]) => (
                  <Panel key={key} className="px-4 py-3">
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                      {key.replaceAll("_", " ")}
                    </dt>
                    <dd className="mt-1 text-2xl font-medium">{value}</dd>
                  </Panel>
                ))}
              </dl>
            )}

            {showChart && Object.keys(summary).length > 0 ? <Chart summary={summary} /> : null}

            {counts ? (
              <div>
                <h2 className="text-sm font-medium">Module totals</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {(
                    [
                      ["users", counts.users],
                      ["people", counts.targets],
                      ["groups", counts.groups],
                      ["campaigns", counts.campaigns],
                      ["enrollments", counts.enrollments],
                      ["checklist templates", counts.checklist_templates],
                      ["checklist instances", counts.checklist_instances],
                      ["tickets open", counts.tickets_open],
                      ["tickets resolved", counts.tickets_resolved],
                    ] as const
                  ).map(([label, value]) => (
                    <Panel key={label} className="px-4 py-3">
                      <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                        {label}
                      </dt>
                      <dd className="mt-1 text-2xl font-medium">{value}</dd>
                    </Panel>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "company" ? <CompanySection /> : null}
        {tab === "users" ? <UsersSection /> : null}
        {tab === "targets" ? <TargetsSection /> : null}
        {tab === "campaigns" ? <CampaignsSection /> : null}
        {tab === "training" ? <TrainingSection /> : null}
        {tab === "checklists" ? <ChecklistsSection /> : null}
        {tab === "ticketing" ? <TicketingSection /> : null}
      </div>
    </div>
  );
}
