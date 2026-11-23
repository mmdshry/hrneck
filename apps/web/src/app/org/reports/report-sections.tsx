"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { toastError } from "@/lib/toast";
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
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [state, setState] = useState<ListState<T>>({
    rows: [],
    meta: emptyMeta(DEFAULT_PAGE_SIZE),
  });
  const [loading, setLoading] = useState(false);

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
      toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [enabled, filterKey, page, perPage, section, tCommon]);

  useEffect(() => {
    void load();
  }, [load, liveEpoch]);

  async function onCsv() {
    try {
      const parsed = JSON.parse(filterKey) as Record<
        string,
        string | number | undefined
      >;
      await downloadReportCsv(section, parsed);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("csvExportFailed"));
    }
  }

  return {
    ...state,
    page,
    perPage,
    loading,
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
  const tCommon = useTranslations("common");
  return (
    <Button type="button" variant="outline" onClick={onCsv}>
      {tCommon("exportCsv")}
    </Button>
  );
}

export function CompanySection({
  sharedFilters,
}: {
  sharedFilters?: ReportSharedFilters;
}) {
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const [company, setCompany] = useState<CompanyPayload | null>(null);
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
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      }
    })();
  }, [filterKey, liveEpoch, tCommon]);

  if (!company) {
    return <p className="text-sm text-[var(--muted-foreground)]">{t("loadingCompany")}</p>;
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
                toastError(err instanceof Error ? err.message : t("csvExportFailed")),
            );
          }}
        >
          {tCommon("exportCsv")}
        </Button>
      </div>
      <Panel className="p-4">
        <h3 className="text-sm font-medium">{t("organizationProfile")}</h3>
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
            <p className="text-sm text-[var(--muted-foreground)]">{t("noProfileFields")}</p>
          ) : null}
        </dl>
      </Panel>

      <Panel className="space-y-3 p-4">
        <h3 className="text-sm font-medium">{t("byDepartment")}</h3>
        <ReportTable
          rows={company.by_department}
          columns={[
            { key: "department", header: tCommon("department"), cell: (r) => r.department },
            { key: "targets", header: tCommon("employees"), cell: (r) => r.targets },
            { key: "sent", header: t("sent"), cell: (r) => r.sent },
            { key: "opened", header: t("opened"), cell: (r) => r.opened },
            { key: "completed", header: tCommon("completed"), cell: (r) => r.completed },
            { key: "opened_pct", header: t("openPct"), cell: (r) => r.opened_pct },
            { key: "completed_pct", header: t("completePct"), cell: (r) => r.completed_pct },
            { key: "no_action_pct", header: t("noActionPct"), cell: (r) => r.no_action_pct },
          ]}
        />
      </Panel>

      <Panel className="space-y-3 p-4">
        <h3 className="text-sm font-medium">{t("byGroup")}</h3>
        <ReportTable
          rows={company.by_group}
          columns={[
            { key: "name", header: tCommon("group"), cell: (r) => r.name },
            { key: "targets", header: tCommon("employees"), cell: (r) => r.targets },
            { key: "source", header: tCommon("source"), cell: (r) => r.source ?? tCommon("emDash") },
          ]}
        />
      </Panel>

      <Panel className="space-y-3 p-4">
        <h3 className="text-sm font-medium">{t("byRole")}</h3>
        <ReportTable
          rows={company.by_role}
          columns={[
            { key: "role", header: tCommon("role"), cell: (r) => r.role },
            { key: "users", header: tCommon("users"), cell: (r) => r.users },
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
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
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
          { key: "name", header: tCommon("name"), cell: (r) => r.name, accessorKey: "name" },
          { key: "email", header: tCommon("email"), cell: (r) => r.email, accessorKey: "email" },
          {
            key: "roles",
            header: tCommon("roles"),
            cell: (r) => r.roles.join(", ") || tCommon("emDash"),
            filterValue: (r) => r.roles,
          },
          {
            key: "mfa",
            header: t("mfa"),
            cell: (r) => (r.mfa_enabled ? tCommon("yes") : tCommon("no")),
            filter: "select",
            filterOptions: [
              { label: tCommon("yes"), value: "yes" },
              { label: tCommon("no"), value: "no" },
            ],
            filterValue: (r) => (r.mfa_enabled ? "yes" : "no"),
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
  const tCommon = useTranslations("common");
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
          { key: "email", header: tCommon("email"), cell: (r) => r.email, accessorKey: "email" },
          {
            key: "name",
            header: tCommon("name"),
            cell: (r) =>
              `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || tCommon("emDash"),
            filterValue: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
          },
          {
            key: "department",
            header: tCommon("department"),
            cell: (r) => r.department ?? tCommon("emDash"),
            accessorKey: "department",
          },
          {
            key: "groups",
            header: tCommon("groups"),
            cell: (r) => r.groups.join(", ") || tCommon("emDash"),
            filterValue: (r) => r.groups,
          },
          {
            key: "status",
            header: tCommon("status"),
            cell: (r) => r.status,
            accessorKey: "status",
          },
          {
            key: "risk",
            header: tCommon("risk"),
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
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
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
    {
      key: "campaign",
      header: tCommon("campaign"),
      cell: (r) => r.name,
      filterValue: (r) => r.name,
    },
    { key: "type", header: tCommon("type"), cell: (r) => r.type, accessorKey: "type" },
    {
      key: "status",
      header: tCommon("status"),
      cell: (r) => r.status,
      accessorKey: "status",
    },
    {
      key: "recipients",
      header: tCommon("recipients"),
      cell: (r) => r.recipients,
      filter: "none",
      enableSorting: true,
    },
    { key: "sent", header: t("sent"), cell: (r) => r.sent, filter: "none", enableSorting: true },
    {
      key: "opened",
      header: t("opened"),
      cell: (r) => r.opened,
      filter: "none",
      enableSorting: true,
    },
    {
      key: "completed",
      header: tCommon("completed"),
      cell: (r) => r.completed,
      filter: "none",
      enableSorting: true,
    },
    {
      key: "opened_pct",
      header: t("openPct"),
      cell: (r) => r.opened_pct,
      filter: "none",
      enableSorting: true,
    },
    {
      key: "completed_pct",
      header: t("completePct"),
      cell: (r) => r.completed_pct,
      filter: "none",
      enableSorting: true,
    },
    {
      key: "no_action_pct",
      header: t("noActionPct"),
      cell: (r) => r.no_action_pct,
      filter: "none",
      enableSorting: true,
    },
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
          {t("clickCampaignForRecipients")}
        </p>
      </SectionShell>

      {campaignId != null ? (
        <Panel className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {t("recipientsForCampaign", { id: campaignId })}
            </h3>
            <div className="flex gap-2">
              <CsvButton onCsv={() => void recipients.onCsv()} />
              <Button type="button" variant="secondary" onClick={() => setCampaignId(null)}>
                {tCommon("close")}
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
                {
                  key: "email",
                  header: tCommon("email"),
                  cell: (r) => r.email ?? tCommon("emDash"),
                  accessorKey: "email",
                },
                {
                  key: "name",
                  header: tCommon("name"),
                  cell: (r) => r.name || tCommon("emDash"),
                  accessorKey: "name",
                },
                {
                  key: "department",
                  header: tCommon("department"),
                  cell: (r) => r.department ?? tCommon("emDash"),
                  accessorKey: "department",
                },
                {
                  key: "status",
                  header: tCommon("status"),
                  cell: (r) => r.status,
                  accessorKey: "status",
                },
                {
                  key: "sent_at",
                  header: t("sent"),
                  cell: (r) => (r.sent_at ? tCommon("yes") : tCommon("emDash")),
                  filter: "none",
                },
                {
                  key: "opened_at",
                  header: t("opened"),
                  cell: (r) => (r.opened_at ? tCommon("yes") : tCommon("emDash")),
                  filter: "none",
                },
                {
                  key: "completed",
                  header: tCommon("completed"),
                  cell: (r) => (r.completed ? tCommon("yes") : tCommon("emDash")),
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
  const tCommon = useTranslations("common");
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
          {
            key: "email",
            header: tCommon("email"),
            cell: (r) => r.email ?? tCommon("emDash"),
            accessorKey: "email",
          },
          {
            key: "name",
            header: tCommon("name"),
            cell: (r) => r.name || tCommon("emDash"),
            accessorKey: "name",
          },
          {
            key: "department",
            header: tCommon("department"),
            cell: (r) => r.department ?? tCommon("emDash"),
            accessorKey: "department",
          },
          {
            key: "course",
            header: tCommon("course"),
            cell: (r) => r.course ?? tCommon("emDash"),
            accessorKey: "course",
          },
          {
            key: "status",
            header: tCommon("status"),
            cell: (r) => r.status,
            accessorKey: "status",
          },
          {
            key: "progress",
            header: tCommon("progress"),
            cell: (r) => `${r.progress}%`,
            filterValue: (r) => r.progress,
          },
          {
            key: "source",
            header: tCommon("source"),
            cell: (r) => r.source,
            accessorKey: "source",
          },
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

function humanizeKey(key: string): string {
  const spaced = key.replaceAll("_", " ");
  return spaced.length > 0
    ? spaced.charAt(0).toUpperCase() + spaced.slice(1)
    : spaced;
}

function checklistCategoryLabel(key: string, translate: (id: string) => string): string {
  switch (key) {
    case "custom":
      return translate("custom");
    case "hr_ops":
      return translate("hrOps");
    case "offboarding":
      return translate("offboarding");
    case "onboarding":
      return translate("onboarding");
    default:
      return humanizeKey(key);
  }
}

function checklistStatusLabel(key: string, translate: (id: string) => string): string {
  switch (key) {
    case "not_started":
      return translate("notStarted");
    case "in_progress":
      return translate("inProgress");
    case "completed":
      return translate("completed");
    case "cancelled":
      return translate("cancelled");
    default:
      return humanizeKey(key);
  }
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
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const tChecklists = useTranslations("org.checklists");
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
          title={t("byCategory")}
          counts={byCategory}
          emptyLabel={t("noTemplates")}
          labelFor={(key) => checklistCategoryLabel(key, tChecklists)}
          barColorFor={() => "var(--primary)"}
        />
        <BreakdownPanel
          title={t("byStatus")}
          counts={byStatus}
          emptyLabel={t("noInstances")}
          labelFor={(key) => checklistStatusLabel(key, tCommon)}
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
            {
              key: "title",
              header: tCommon("titleLabel"),
              cell: (r) => r.title,
              accessorKey: "title",
            },
            {
              key: "template",
              header: tCommon("template"),
              cell: (r) => r.template ?? tCommon("emDash"),
              accessorKey: "template",
            },
            {
              key: "category",
              header: tCommon("category"),
              cell: (r) => r.category ?? tCommon("emDash"),
              accessorKey: "category",
            },
            {
              key: "assignee",
              header: tCommon("assignee"),
              cell: (r) => r.email ?? tCommon("emDash"),
              filterValue: (r) => r.email,
            },
            {
              key: "status",
              header: tCommon("status"),
              cell: (r) => r.status,
              accessorKey: "status",
            },
            {
              key: "progress",
              header: tCommon("progress"),
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
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const tTicketing = useTranslations("org.ticketing");
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
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {tCommon("open")}
              </p>
              <p className="mt-1 text-2xl font-medium">{summary.total_open}</p>
            </Panel>
            <Panel className="px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {tCommon("resolved")}
              </p>
              <p className="mt-1 text-2xl font-medium">{summary.total_resolved}</p>
            </Panel>
            <Panel className="px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {t("responseBreach")}
              </p>
              <p className="mt-1 text-2xl font-medium">{summary.sla_response_breached}</p>
            </Panel>
            <Panel className="px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                {t("resolveBreach")}
              </p>
              <p className="mt-1 text-2xl font-medium">{summary.sla_resolve_breached}</p>
            </Panel>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <BreakdownPanel
              title={t("byDesk")}
              counts={summary.by_desk ?? {}}
              emptyLabel={t("noDesks")}
              labelFor={humanizeKey}
              barColorFor={() => "var(--primary)"}
            />
            <BreakdownPanel
              title={t("byPriority")}
              counts={summary.by_priority ?? {}}
              emptyLabel={t("noPriorities")}
              labelFor={humanizeKey}
              barColorFor={() => "var(--primary)"}
            />
            <BreakdownPanel
              title={t("byStage")}
              counts={summary.by_stage ?? {}}
              emptyLabel={t("noStages")}
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
            {
              key: "number",
              header: tCommon("number"),
              cell: (r) => r.number,
              accessorKey: "number",
            },
            {
              key: "summary",
              header: tCommon("summary"),
              cell: (r) => r.summary,
              accessorKey: "summary",
            },
            {
              key: "desk",
              header: tCommon("desk"),
              cell: (r) => r.desk ?? tCommon("emDash"),
              accessorKey: "desk",
            },
            {
              key: "stage",
              header: tCommon("stage"),
              cell: (r) => r.stage ?? tCommon("emDash"),
              accessorKey: "stage",
            },
            {
              key: "priority",
              header: tCommon("priority"),
              cell: (r) => r.priority ?? tCommon("emDash"),
              accessorKey: "priority",
            },
            {
              key: "status",
              header: tCommon("status"),
              cell: (r) => r.status ?? tCommon("emDash"),
              accessorKey: "status",
            },
            {
              key: "sla",
              header: tTicketing("sla"),
              cell: (r) =>
                [
                  r.sla_response_breached ? t("slaResponse") : null,
                  r.sla_resolve_breached ? t("slaResolve") : null,
                ]
                  .filter(Boolean)
                  .join(", ") || tCommon("ok"),
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
  children,
}: {
  list: ReturnType<typeof useReportSection<T>>;
  children: ReactNode;
}) {
  return <div className="space-y-3">{children}</div>;
}
