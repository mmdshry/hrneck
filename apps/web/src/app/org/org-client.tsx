"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import { api, apiOptional, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery, parsePaginatedResponse } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  resolveDashboardModuleLinks,
  resolveDashboardWidgets,
  type DashboardNavKey,
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

type MetricStat = {
  label: string;
  value: string | number;
  /** Destructive styling; always paired with the visible label. */
  tone?: "danger" | undefined;
};

type MetricProgress = { label: string; percent: number };

type WidgetMetrics = {
  primaryLabel: string;
  primaryValue: string | number;
  progress: MetricProgress | null;
  stats: MetricStat[];
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

function breachStat(label: string, breaches: number): MetricStat {
  return {
    label,
    value: breaches,
    tone: breaches > 0 ? "danger" : undefined,
  };
}

function MetricWidget({
  title,
  icon: Icon,
  href,
  primaryLabel,
  primaryValue,
  progress,
  stats,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  primaryLabel: string;
  primaryValue: string | number;
  progress: MetricProgress | null;
  stats: MetricStat[];
}) {
  const percent = progress
    ? Math.min(100, Math.max(0, Math.round(progress.percent)))
    : 0;
  const lastStatSpansRow = stats.length % 2 === 1;

  return (
    <article className="flex flex-col rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)] transition-[box-shadow,border-color] duration-200 hover:border-[var(--primary)]/40 hover:shadow-md motion-reduce:transition-none">
      <h2 className="text-sm font-semibold">
        <Link
          href={href}
          className={cn(
            "group flex min-h-11 items-center gap-3 rounded-[var(--radius)]",
            focusRing,
          )}
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </Link>
      </h2>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
          {primaryLabel}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
          {primaryValue}
        </p>
        {progress ? (
          <div
            role="progressbar"
            aria-label={progress.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}%`}
            className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]"
          >
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-2">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-md bg-[var(--muted)]/50 px-3 py-2",
              lastStatSpansRow && index === stats.length - 1 && "col-span-2",
            )}
          >
            <dt className="text-xs text-[var(--muted-foreground)]">
              {stat.label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                stat.tone === "danger" && "text-[var(--destructive)]",
              )}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ShortcutTile({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm font-medium shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--primary)]/40 hover:shadow-md motion-reduce:transition-none",
        focusRing,
      )}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
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
        progress: { label: labels.completion, percent: completion },
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
          progress: {
            label: labels.completion,
            percent: checklists.completion_rate,
          },
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
        progress: null,
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
          progress: null,
          stats: [
            { label: labels.resolved, value: ticketing.resolved },
            breachStat(labels.slaResponseBreach, ticketing.sla_response_breached),
            breachStat(labels.slaResolveBreach, ticketing.sla_resolve_breached),
          ],
        };
      }
      if (ticketingFallback) {
        return {
          primaryLabel: labels.open,
          primaryValue: ticketingFallback.total_open,
          progress: null,
          stats: [
            { label: labels.resolved, value: ticketingFallback.total_resolved },
            breachStat(
              labels.slaResponseBreach,
              ticketingFallback.sla_response_breached,
            ),
            breachStat(
              labels.slaResolveBreach,
              ticketingFallback.sla_resolve_breached,
            ),
          ],
        };
      }
      if (ticketsTotal != null) {
        return {
          primaryLabel: labels.tickets,
          primaryValue: ticketsTotal,
          progress: null,
          stats: [{ label: labels.inQueue, value: ticketsTotal }],
        };
      }
      return null;
    }
    case "people": {
      // Employees and login accounts are one list now, so the card counts employees.
      const employees =
        blocks?.campaigns_people?.active_employees ??
        campaign?.active_employees ??
        counts?.targets;
      if (employees == null) {
        return null;
      }
      return {
        primaryLabel: labels.activeEmployees,
        primaryValue: employees,
        progress: null,
        stats: [{ label: labels.groups, value: counts?.groups ?? labels.dash }],
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
  const tNav = useTranslations("nav");
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
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  const actingInTenant = Boolean(user?.acting_in_tenant);
  const blockOrgMetrics =
    user?.is_platform_staff === true && !actingInTenant;
  const canViewReports = hasPermission(user, "org.reports.view");
  const widgets = useMemo(() => resolveDashboardWidgets(user), [user]);
  const coveredNavKeys = useMemo(
    () => new Set<DashboardNavKey>(widgets.map((widget) => widget.navKey)),
    [widgets],
  );
  const shortcuts = useMemo(
    () => resolveDashboardModuleLinks(user, coveredNavKeys),
    [user, coveredNavKeys],
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

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

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
        widgetLabels,
      ) ??
      ({
        primaryLabel: tCommon("status"),
        primaryValue: tCommon("emDash"),
        progress: null,
        stats: [{ label: t("details"), value: t("openModule") }],
      } satisfies WidgetMetrics);
    return { widget, metrics };
  });

  const waitingForMetrics =
    !blockOrgMetrics && widgets.length > 0 && !metricsLoaded;
  // Shortcuts sit below the cards, so wait for metrics to avoid layout shift.
  const contentReady =
    !blockOrgMetrics && (metricsLoaded || widgets.length === 0);
  const showWidgets = contentReady && renderedWidgets.length > 0;
  const showShortcuts = contentReady && shortcuts.length > 0;
  const showEmpty =
    !blockOrgMetrics && widgets.length === 0 && shortcuts.length === 0;

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
      {waitingForMetrics ? (
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          {statusLabel ?? t("loadingMetrics")}
        </p>
      ) : null}

      {showWidgets ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {renderedWidgets.map(({ widget, metrics }) => (
            <MetricWidget
              key={widget.id}
              title={tNav(widget.navKey)}
              icon={widget.icon}
              href={widget.href}
              primaryLabel={metrics.primaryLabel}
              primaryValue={metrics.primaryValue}
              progress={metrics.progress}
              stats={metrics.stats}
            />
          ))}
        </div>
      ) : null}

      {showShortcuts ? (
        <section aria-labelledby="org-dashboard-quick-access" className="mt-8">
          <h2
            id="org-dashboard-quick-access"
            className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]"
          >
            {t("quickAccess")}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.navKey}>
                <ShortcutTile
                  href={shortcut.href}
                  label={tNav(shortcut.navKey)}
                  icon={shortcut.icon}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showEmpty ? (
        <div className="mt-6">
          <EmptyState title={t("empty")} />
        </div>
      ) : null}
    </div>
  );
}
