"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, apiOptional, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery, parsePaginatedResponse } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import {
  resolveDashboardModuleLinks,
  resolveDashboardWidgets,
  type DashboardWidgetId,
} from "@/app/org/dashboard-widgets";
import type {
  CampaignSummary,
  DetailedOverview,
  OverviewBlocks,
  TicketingSummary,
} from "@/app/org/reports/report-types";

type DetailedLivePayload = {
  overview?: DetailedOverview;
};

type MetricStat = { label: string; value: string | number };

type WidgetMetrics = {
  primaryLabel: string;
  primaryValue: string | number;
  stats: MetricStat[];
};

function MetricWidget({
  title,
  primaryLabel,
  primaryValue,
  stats,
  href,
  hrefLabel,
}: {
  title: string;
  primaryLabel: string;
  primaryValue: string | number;
  stats: MetricStat[];
  href: string;
  hrefLabel: string;
}) {
  return (
    <Panel className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
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
      <div className="mt-4">
        <LinkButton href={href} variant="outline" size="sm">
          {hrefLabel}
        </LinkButton>
      </div>
    </Panel>
  );
}

function metricsForWidget(
  id: DashboardWidgetId,
  blocks: OverviewBlocks | null,
  campaign: CampaignSummary | null,
  counts: DetailedOverview["counts"] | null,
  ticketingFallback: TicketingSummary | null,
  ticketsTotal: number | null,
  checklistOpen: number | null,
  checklistTotal: number | null,
  usersTotal: number | null,
  labels: {
    completion: string;
    runningCampaigns: string;
    noAction: string;
    assigned: string;
    inProgress: string;
    open: string;
    completed: string;
    total: string;
    totalInstances: string;
    resolved: string;
    slaResponseBreach: string;
    slaResolveBreach: string;
    tickets: string;
    inQueue: string;
    users: string;
    activeEmployees: string;
    groups: string;
    dash: string;
  },
): WidgetMetrics | null {
  switch (id) {
    case "training": {
      const training = blocks?.training;
      const people = blocks?.campaigns_people;
      if (!training && !campaign && !people) {
        return null;
      }
      const completion =
        training?.completion_rate ?? campaign?.completed_pct ?? 0;
      return {
        primaryLabel: labels.completion,
        primaryValue: `${completion}%`,
        stats: [
          {
            label: labels.runningCampaigns,
            value:
              people?.campaigns_running ?? campaign?.campaigns_running ?? labels.dash,
          },
          {
            label: labels.noAction,
            value:
              campaign?.no_action != null
                ? campaign.no_action
                : people?.no_action_pct != null
                  ? `${people.no_action_pct}%`
                  : labels.dash,
          },
          {
            label: labels.assigned,
            value: training?.assigned ?? campaign?.enrollments ?? labels.dash,
          },
          {
            label: labels.inProgress,
            value: training?.in_progress ?? labels.dash,
          },
        ],
      };
    }
    case "checklists": {
      const checklists = blocks?.checklists;
      if (checklists) {
        return {
          primaryLabel: labels.open,
          primaryValue: checklists.open,
          stats: [
            { label: labels.completed, value: checklists.completed },
            { label: labels.total, value: checklists.total },
            { label: labels.completion, value: `${checklists.completion_rate}%` },
          ],
        };
      }
      if (checklistOpen == null && checklistTotal == null) {
        return null;
      }
      return {
        primaryLabel: labels.open,
        primaryValue: checklistOpen ?? labels.dash,
        stats: [
          { label: labels.totalInstances, value: checklistTotal ?? labels.dash },
        ],
      };
    }
    case "ticketing": {
      const ticketing = blocks?.ticketing;
      if (ticketing) {
        return {
          primaryLabel: labels.open,
          primaryValue: ticketing.open,
          stats: [
            { label: labels.resolved, value: ticketing.resolved },
            {
              label: labels.slaResponseBreach,
              value: ticketing.sla_response_breached,
            },
            {
              label: labels.slaResolveBreach,
              value: ticketing.sla_resolve_breached,
            },
          ],
        };
      }
      if (ticketingFallback) {
        return {
          primaryLabel: labels.open,
          primaryValue: ticketingFallback.total_open,
          stats: [
            { label: labels.resolved, value: ticketingFallback.total_resolved },
            {
              label: labels.slaResponseBreach,
              value: ticketingFallback.sla_response_breached,
            },
            {
              label: labels.slaResolveBreach,
              value: ticketingFallback.sla_resolve_breached,
            },
          ],
        };
      }
      if (ticketsTotal != null) {
        return {
          primaryLabel: labels.tickets,
          primaryValue: ticketsTotal,
          stats: [{ label: labels.inQueue, value: ticketsTotal }],
        };
      }
      return null;
    }
    case "people": {
      const users = counts?.users ?? usersTotal;
      const employees =
        blocks?.campaigns_people?.active_employees ??
        campaign?.active_employees ??
        counts?.targets;
      if (users == null && employees == null) {
        return null;
      }
      return {
        primaryLabel: labels.users,
        primaryValue: users ?? labels.dash,
        stats: [
          { label: labels.activeEmployees, value: employees ?? labels.dash },
          { label: labels.groups, value: counts?.groups ?? labels.dash },
        ],
      };
    }
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function OrgDashboardClient() {
  const t = useTranslations("org.dashboard");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [blocks, setBlocks] = useState<OverviewBlocks | null>(null);
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [counts, setCounts] = useState<DetailedOverview["counts"] | null>(null);
  const [ticketingFallback, setTicketingFallback] =
    useState<TicketingSummary | null>(null);
  const [ticketsTotal, setTicketsTotal] = useState<number | null>(null);
  const [checklistOpen, setChecklistOpen] = useState<number | null>(null);
  const [checklistTotal, setChecklistTotal] = useState<number | null>(null);
  const [usersTotal, setUsersTotal] = useState<number | null>(null);
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  const actingInTenant = Boolean(user?.acting_in_tenant);
  const blockOrgMetrics =
    user?.is_platform_staff === true && !actingInTenant;
  const canViewReports = hasPermission(user, "org.reports.view");
  const widgets = useMemo(() => resolveDashboardWidgets(user), [user]);
  const moduleLinks = useMemo(
    () => resolveDashboardModuleLinks(user),
    [user],
  );

  const channel = useMemo(() => {
    if (!ready || blockOrgMetrics || !canViewReports) {
      return null;
    }
    return `org.${tenant}.reports-detailed`;
  }, [ready, blockOrgMetrics, canViewReports, tenant]);

  const applyOverview = useCallback((overview: DetailedOverview) => {
    setBlocks(overview.blocks ?? null);
    setCampaign(overview.campaign ?? null);
    setCounts(overview.counts ?? null);
  }, []);

  const onPayload = useCallback(
    (payload: DetailedLivePayload) => {
      if (payload.overview) {
        applyOverview(payload.overview);
      }
    },
    [applyOverview],
  );

  const { status, error: liveError } = useLiveTopic<DetailedLivePayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveError && !blockOrgMetrics && canViewReports) {
      toastError(liveError);
    }
  }, [liveError, blockOrgMetrics, canViewReports]);

  useEffect(() => {
    void fetchSessionUser().then((sessionUser) => {
      setUser(sessionUser);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready || !user || blockOrgMetrics) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setMetricsLoaded(false);
      await ensureCsrf();
      const tenantSlug = resolveTenant();

      try {
        if (canViewReports) {
          const res = await api<{ data: DetailedOverview }>(
            "/api/v1/org/reports/detailed",
            { tenant: tenantSlug },
          );
          if (!cancelled && res.data) {
            applyOverview(res.data);
          }
          if (!cancelled) {
            setMetricsLoaded(true);
          }
          return;
        }

        const tasks: Array<Promise<void>> = [];

        if (
          hasPermission(user, "org.ticketing.reports") ||
          hasPermission(user, "org.ticketing.tickets")
        ) {
          tasks.push(
            (async () => {
              if (hasPermission(user, "org.ticketing.reports")) {
                const summary = await apiOptional<{ data: TicketingSummary }>(
                  "/api/v1/org/ticketing/reports/summary",
                  { tenant: tenantSlug },
                );
                if (!cancelled && summary?.data) {
                  setTicketingFallback(summary.data);
                  return;
                }
              }
              const list = await apiOptional(
                `/api/v1/org/ticketing/tickets?${paginationQuery(1, 1)}`,
                { tenant: tenantSlug },
              );
              if (!cancelled && list) {
                setTicketsTotal(parsePaginatedResponse(list, 1).meta.total);
              }
            })(),
          );
        }

        if (hasPermission(user, "org.checklists.manage")) {
          tasks.push(
            (async () => {
              const [notStarted, inProgress, allList] = await Promise.all([
                apiOptional(
                  `/api/v1/org/checklists/instances?${paginationQuery(1, 1, {
                    status: "not_started",
                  })}`,
                  { tenant: tenantSlug },
                ),
                apiOptional(
                  `/api/v1/org/checklists/instances?${paginationQuery(1, 1, {
                    status: "in_progress",
                  })}`,
                  { tenant: tenantSlug },
                ),
                apiOptional(
                  `/api/v1/org/checklists/instances?${paginationQuery(1, 1)}`,
                  { tenant: tenantSlug },
                ),
              ]);
              if (cancelled) return;
              const openCount =
                (notStarted
                  ? parsePaginatedResponse(notStarted, 1).meta.total
                  : 0) +
                (inProgress
                  ? parsePaginatedResponse(inProgress, 1).meta.total
                  : 0);
              if (notStarted || inProgress) {
                setChecklistOpen(openCount);
              }
              if (allList) {
                setChecklistTotal(parsePaginatedResponse(allList, 1).meta.total);
              }
            })(),
          );
        }

        if (hasPermission(user, "org.users.manage")) {
          tasks.push(
            (async () => {
              const list = await apiOptional(
                `/api/v1/org/users?${paginationQuery(1, 1)}`,
                { tenant: tenantSlug },
              );
              if (!cancelled && list) {
                setUsersTotal(parsePaginatedResponse(list, 1).meta.total);
              }
            })(),
          );
        }

        await Promise.all(tasks);
        if (!cancelled) {
          setMetricsLoaded(true);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          toastError(err instanceof Error ? err.message : t("loadFailed"));
          setMetricsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user, blockOrgMetrics, canViewReports, applyOverview, t]);

  const statusLabel = liveStatusLabel(status);

  const widgetLabels = useMemo(
    () => ({
      completion: t("completion"),
      runningCampaigns: t("runningCampaigns"),
      noAction: t("noAction"),
      assigned: t("assigned"),
      inProgress: t("inProgress"),
      open: t("open"),
      completed: t("completed"),
      total: t("total"),
      totalInstances: t("totalInstances"),
      resolved: t("resolved"),
      slaResponseBreach: t("slaResponseBreach"),
      slaResolveBreach: t("slaResolveBreach"),
      tickets: t("tickets"),
      inQueue: t("inQueue"),
      users: t("users"),
      activeEmployees: t("activeEmployees"),
      groups: t("groups"),
      dash: tCommon("emDash"),
    }),
    [t, tCommon],
  );

  if (!ready) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  const renderedWidgets = widgets.map((widget) => {
    const metrics =
      metricsForWidget(
        widget.id,
        blocks,
        campaign,
        counts,
        ticketingFallback,
        ticketsTotal,
        checklistOpen,
        checklistTotal,
        usersTotal,
        widgetLabels,
      ) ??
      ({
        primaryLabel: tCommon("status"),
        primaryValue: tCommon("emDash"),
        stats: [{ label: t("details"), value: t("openModule") }],
      } satisfies WidgetMetrics);
    return { widget, metrics };
  });

  const waitingForMetrics =
    !blockOrgMetrics && widgets.length > 0 && !metricsLoaded;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        {t("eyebrow", { tenant })}
        {!blockOrgMetrics && canViewReports
          ? statusLabel
            ? ` · ${statusLabel}`
            : ` · ${tCommon("live")}`
          : ""}
      </p>
      <PageHeader
        className="mt-2"
        title={t("title")}
        description={t("description")}
      />
      {blockOrgMetrics ? (
        <EmptyState title={t("openTenantFilament")} />
      ) : null}
      {!blockOrgMetrics && waitingForMetrics ? (
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          {statusLabel ?? t("loadingMetrics")}
        </p>
      ) : null}

      {!blockOrgMetrics && metricsLoaded && renderedWidgets.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {renderedWidgets.map(({ widget, metrics }) => (
            <MetricWidget
              key={widget.id}
              title={widget.title}
              primaryLabel={metrics.primaryLabel}
              primaryValue={metrics.primaryValue}
              stats={metrics.stats}
              href={widget.href}
              hrefLabel={widget.hrefLabel}
            />
          ))}
        </div>
      ) : null}

      {!blockOrgMetrics && widgets.length === 0 ? (
        <div className="mt-6 space-y-4">
          <EmptyState title="No dashboard metrics for your current permissions. Open a module you can access from the sidebar, or ask an admin for reporting access." />
          {moduleLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {moduleLinks.map((link) => (
                <LinkButton
                  key={link.href}
                  href={link.href}
                  variant="secondary"
                  size="sm"
                >
                  {link.label}
                </LinkButton>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
