"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  GraduationCap,
  Layers,
  Library,
  Settings2,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import type { CampaignSummary } from "@/app/org/reports/report-types";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  {
    href: "/org/training",
    label: "Training",
    icon: GraduationCap,
  },
  {
    href: "/org/courses",
    label: "Courses",
    icon: Library,
  },
  { href: "/org/targets", label: "Employees", icon: Target },
  { href: "/org/departments", label: "Departments", icon: Layers },
  { href: "/org/groups", label: "Groups", icon: UsersRound },
  { href: "/org/reports/export", label: "Report export", icon: Download },
  { href: "/org/settings", label: "Settings", icon: Settings2 },
];

type MetricsPayload = {
  summary: CampaignSummary;
};

const SUMMARY_CARDS: Array<{ key: keyof CampaignSummary; label: string; suffix?: string }> = [
  { key: "campaigns_running", label: "Running campaigns" },
  { key: "opened_pct", label: "Open rate", suffix: "%" },
  { key: "completed_pct", label: "Complete rate", suffix: "%" },
  { key: "no_action_pct", label: "No-action rate", suffix: "%" },
  { key: "enrollments", label: "Enrollments" },
  { key: "active_employees", label: "Active employees" },
];

export function OrgDashboardClient() {
  const tenant = resolveTenant();
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [platformStaff, setPlatformStaff] = useState<boolean | null>(null);

  const channel = useMemo(
    () => (platformStaff === false ? `org.${tenant}.metrics` : null),
    [platformStaff, tenant],
  );

  const onPayload = useCallback((payload: MetricsPayload) => {
    setSummary(payload.summary ?? null);
  }, []);

  const refreshFromApi = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: CampaignSummary }>(
      "/api/v1/org/reports/summary",
      { tenant: resolveTenant() },
    );
    setSummary(res.data ?? null);
  }, []);

  const { status, error } = useLiveTopic<MetricsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser().then((sessionUser) => {
      setPlatformStaff(Boolean(sessionUser?.is_platform_staff));
    });
  }, []);

  useEffect(() => {
    if (platformStaff !== false) {
      return;
    }
    void refreshFromApi().catch(() => {
      /* live channel may still populate */
    });
  }, [platformStaff, refreshFromApi]);

  const statusLabel = liveStatusLabel(status);

  if (platformStaff === null) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
        Tenant admin · {tenant}
        {platformStaff === false
          ? statusLabel
            ? ` · ${statusLabel}`
            : " · Live"
          : ""}
      </p>
      <PageHeader
        className="mt-2"
        title="Organization dashboard"
        description="Live training posture for this tenant."
      />
      {platformStaff === true ? (
        <Alert className="mt-4">
          Open this organization in Filament. Live metrics are for organization
          users.
        </Alert>
      ) : null}
      {error && platformStaff === false ? (
        <Alert className="mt-4" variant="destructive">
          {error}{" "}
          <LinkButton href="/login" variant="link" size="sm" className="px-1">
            Go to login
          </LinkButton>
        </Alert>
      ) : null}
      {!summary ? (
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          {statusLabel ?? "Waiting for live metrics…"}
        </p>
      ) : (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SUMMARY_CARDS.map((card) => (
            <Panel key={card.key} className="px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {card.label}
              </dt>
              <dd className="mt-1 text-2xl font-medium tabular-nums">
                {summary[card.key]}
                {card.suffix ?? ""}
              </dd>
            </Panel>
          ))}
        </dl>
      )}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <LinkButton
              key={link.href}
              href={link.href}
              variant="secondary"
              className="h-auto justify-start gap-3 px-5 py-5 text-base"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] bg-[var(--background)] text-[var(--primary)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>{link.label}</span>
            </LinkButton>
          );
        })}
      </div>
    </div>
  );
}
