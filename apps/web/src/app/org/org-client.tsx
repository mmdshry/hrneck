"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  GraduationCap,
  Settings2,
  Target,
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

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  {
    href: "/org/training",
    label: "Training",
    icon: GraduationCap,
  },
  { href: "/org/targets", label: "Targets & groups", icon: Target },
  { href: "/org/reports/export", label: "Report export", icon: Download },
  { href: "/org/settings", label: "Settings", icon: Settings2 },
];

type MetricsPayload = {
  summary: Record<string, number>;
};

export function OrgDashboardClient() {
  const tenant = resolveTenant();
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [platformStaff, setPlatformStaff] = useState<boolean | null>(null);

  const channel = useMemo(
    () => (platformStaff === false ? `org.${tenant}.metrics` : null),
    [platformStaff, tenant],
  );

  const onPayload = useCallback((payload: MetricsPayload) => {
    setSummary(payload.summary ?? {});
  }, []);

  const refreshFromApi = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: Record<string, number> }>(
      "/api/v1/org/reports/summary",
      { tenant: resolveTenant() },
    );
    setSummary(res.data ?? {});
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
      {Object.keys(summary).length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          {statusLabel ?? "Waiting for live metrics…"}
        </p>
      ) : (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--background)] text-[var(--accent)]">
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
