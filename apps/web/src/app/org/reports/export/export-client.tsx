"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { useDataTableQuery } from "@/hooks/use-data-table-query";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import { serializeDataTableQuery } from "@/lib/data-table-query";
import {
  DEFAULT_PAGE_SIZE,
  emptyMeta,
  paginateLocal,
  parsePaginatedResponse,
  paginationQuery,
  type PageSize,
  type PaginationMeta,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";

type Calendar = {
  year: number;
  months: { key: string; label: string; available: boolean }[];
  quarters: { key: string; label: string; available: boolean }[];
};

type Archive = {
  id: number;
  name: string;
  scope: string;
  period_key: string;
  status: string;
  generated_at?: string;
};

type ExportPayload = {
  calendar: Calendar;
  logs: Archive[];
};

function matchesCells(
  q: string,
  columnFilters: Record<string, string>,
  cells: Record<string, string>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle && !Object.values(cells).join(" ").toLowerCase().includes(needle)) {
    return false;
  }
  for (const [key, raw] of Object.entries(columnFilters)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
  }
  return true;
}

function archiveCells(row: Archive): Record<string, string> {
  return {
    name: row.name,
    scope: row.scope,
    period: row.period_key,
    status: row.status,
  };
}

export function ReportExportClient() {
  const t = useTranslations("org.export");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const [tab, setTab] = useState<"business" | "user">("business");
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [logs, setLogs] = useState<Archive[]>([]);
  const [allLogs, setAllLogs] = useState<Archive[] | null>(null);
  const [logsMeta, setLogsMeta] = useState<PaginationMeta>(emptyMeta());
  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [timezone, setTimezone] = useState("UTC");
  const [includeTraining, setIncludeTraining] = useState(true);
  const [periodKey, setPeriodKey] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const tableQuery = useDataTableQuery();
  const filters = useMemo(
    () => serializeDataTableQuery(tableQuery.debounced),
    [tableQuery.debounced],
  );
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);
  const filtersKeyRef = useRef(filtersKey);

  const channel = useMemo(() => `org.${tenant}.reports-export`, [tenant]);

  const applyLogSlice = useCallback(
    (
      items: Archive[],
      nextPage: number,
      nextPerPage: number,
      q: string,
      columnFilters: Record<string, string>,
    ) => {
      const filtered = items.filter((row) => matchesCells(q, columnFilters, archiveCells(row)));
      const sliced = paginateLocal(filtered, nextPage, nextPerPage);
      setLogs(sliced.data);
      setLogsMeta(sliced.meta);
      setLogsPage(sliced.meta.current_page);
    },
    [],
  );

  const applyExportState = useCallback(
    (nextCalendar: Calendar | null, nextLogs: Archive[] | null, fromLive: boolean) => {
      setCalendar(nextCalendar);
      setPeriodKey((current) => {
        if (current) return current;
        return nextCalendar?.quarters?.[0]?.key ?? "";
      });
      if (fromLive && nextLogs) {
        setAllLogs(nextLogs);
      } else if (!fromLive) {
        setAllLogs(null);
      }
    },
    [],
  );

  const refreshFromApi = useCallback(
    async (nextPage: number, nextPerPage: number, nextFilters: Record<string, string>) => {
      await ensureCsrf();
      const t = resolveTenant();
      const [archives, cal] = await Promise.all([
        api(`/api/v1/org/reports/export?${paginationQuery(nextPage, nextPerPage, nextFilters)}`, {
          tenant: t,
        }),
        api<{ data: Calendar }>("/api/v1/org/reports/export/calendar", { tenant: t }),
      ]);
      applyExportState(cal.data ?? null, null, false);
      const parsed = parsePaginatedResponse<Archive>(archives, nextPerPage);
      setLogs(parsed.data);
      setLogsMeta(parsed.meta);
      setLogsPage(parsed.meta.current_page);
    },
    [applyExportState],
  );

  const onPayload = useCallback(
    (payload: ExportPayload) => {
      const nextLogs = Array.isArray(payload.logs) ? payload.logs : [];
      applyExportState(payload.calendar ?? null, nextLogs, true);
    },
    [applyExportState],
  );

  const { status, error: liveError } = useLiveTopic<ExportPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    if (filtersKeyRef.current !== filtersKey) {
      filtersKeyRef.current = filtersKey;
      if (logsPage !== 1) {
        setLogsPage(1);
        return;
      }
    }
    if (allLogs !== null) {
      applyLogSlice(
        allLogs,
        logsPage,
        logsPerPage,
        tableQuery.debounced.q,
        tableQuery.debounced.columnFilters,
      );
      return;
    }
    void refreshFromApi(logsPage, logsPerPage, filters).catch((err: unknown) => {
      toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
    });
  }, [
    allLogs,
    logsPage,
    logsPerPage,
    filters,
    filtersKey,
    applyLogSlice,
    refreshFromApi,
    tableQuery.debounced,
    tCommon,
  ]);

  const statusLabel = liveStatusLabel(status);

  async function generate(scope: "business" | "user", key: string, periodType: string) {
    try {
      await ensureCsrf();
      await api("/api/v1/org/reports/export", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          period_type: periodType,
          period_key: key,
          timezone,
          include_training: includeTraining,
        }),
      });
      await refreshFromApi(logsPage, logsPerPage, filters);
      toastSuccess(`Generated ${scope} report for ${key}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("generateFailed"));
    }
  }

  async function onUserGenerate(event: FormEvent) {
    event.preventDefault();
    if (!periodKey) return;
    const periodType = periodKey.includes("-Q") ? "quarterly" : "monthly";
    await generate("user", periodKey, periodType);
  }

  async function download(id: number, key: string) {
    try {
      await ensureCsrf();
      const token = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1];
      const response = await fetch(`/api/v1/org/reports/export/${id}/download`, {
        credentials: "include",
        headers: {
          Accept: "application/pdf",
          "X-Requested-With": "XMLHttpRequest",
          "X-Tenant": resolveTenant(),
          ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}),
        },
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${key}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("downloadFailed"));
    }
  }

  async function deleteArchive(id: number) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/reports/export/${id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setAllLogs(null);
      await refreshFromApi(logsPage, logsPerPage, filters);
      toastSuccess(t("archiveDeleted"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
      throw err;
    }
  }

  const scopeOptions = [
    { label: t("business"), value: "business" },
    { label: t("user"), value: "user" },
  ];
  const statusOptions = [{ label: tCommon("ready"), value: "ready" }];

  const columns: Array<DataTableColumn<Archive>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "scope",
      header: tCommon("scope"),
      filter: "select",
      filterOptions: scopeOptions,
      accessorKey: "scope",
      cell: (row) => row.scope,
    },
    {
      id: "period",
      header: tCommon("period"),
      filterValue: (row) => row.period_key,
      cell: (row) => row.period_key,
    },
    {
      id: "status",
      header: tCommon("status"),
      filter: "select",
      filterOptions: statusOptions,
      accessorKey: "status",
      cell: (row) => row.status,
    },
    {
      id: "generated_at",
      header: tCommon("generated"),
      filter: "none",
      cell: (row) =>
        row.generated_at ? new Date(row.generated_at).toLocaleString() : tCommon("emDash"),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => void download(row.id, row.period_key)}
          >
            {tCommon("download")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="compact"
            onClick={() => setPendingDeleteId(row.id)}
          >
            {tCommon("delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={t("descriptionRollup")}
        actions={
          <span className="text-sm text-[var(--muted-foreground)]">
            {statusLabel ?? tCommon("live")}
          </span>
        }
      />
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label={t("exportMode")}>
        {(["business", "user"] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            role="tab"
            aria-selected={tab === mode}
            variant={tab === mode ? "default" : "secondary"}
            onClick={() => setTab(mode)}
          >
            {mode === "business" ? t("business") : t("user")}
          </Button>
        ))}
      </div>
      {tab === "business" && calendar ? (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-xl font-medium text-[var(--foreground)]">{tCommon("monthly")}</h2>
            {calendar.months.length === 0 ? (
              <EmptyState
                className="mt-4"
                title={t("noMonths")}
                description={t("periodsAppear")}
              />
            ) : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {calendar.months.map((m) => (
                  <li key={m.key}>
                    <Panel className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>
                        {m.label} {calendar.year}
                      </span>
                      {m.available ? (
                        <Button
                          type="button"
                          variant="link"
                          className="min-h-0 px-2 py-1"
                          onClick={() => void generate("business", m.key, "monthly")}
                        >
                          {tCommon("download")}
                        </Button>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">
                          {tCommon("unavailable")}
                        </span>
                      )}
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-xl font-medium text-[var(--foreground)]">
              {tCommon("quarterly")}
            </h2>
            {calendar.quarters.length === 0 ? (
              <EmptyState
                className="mt-4"
                title={t("noQuarters")}
                description={t("periodsAppear")}
              />
            ) : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-4">
                {calendar.quarters.map((q) => (
                  <li key={q.key}>
                    <Panel className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>
                        {q.label} {calendar.year}
                      </span>
                      {q.available ? (
                        <Button
                          type="button"
                          variant="link"
                          className="min-h-0 px-2 py-1"
                          onClick={() => void generate("business", q.key, "quarterly")}
                        >
                          {tCommon("pdf")}
                        </Button>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">
                          {tCommon("unavailable")}
                        </span>
                      )}
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
      {tab === "business" && !calendar ? (
        <MinimalLoader className="mt-8" label={statusLabel ?? tCommon("loadingCalendar")} />
      ) : null}
      {tab === "user" ? (
        <form onSubmit={onUserGenerate} className="mt-8 max-w-lg space-y-4">
          <div className="space-y-1">
            <Label htmlFor="export-period-key" className="text-[var(--muted-foreground)]">
              {t("periodKey")}
            </Label>
            <Input
              id="export-period-key"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              placeholder="2026-Q3"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="export-timezone" className="text-[var(--muted-foreground)]">
              {tCommon("timezone")}
            </Label>
            <Input
              id="export-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeTraining}
              onChange={(e) => setIncludeTraining(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            {t("includeTraining")}
          </label>
          <Button type="submit">{t("generatePdf")}</Button>
        </form>
      ) : null}
      <section className="mt-12">
        <h2 className="text-xl font-medium text-[var(--foreground)]">{t("reportLog")}</h2>
        <DataTable
          className="mt-4"
          mode="server"
          caption={t("reportLog")}
          columns={columns}
          rows={logs}
          filterState={tableQuery.state}
          onFilterStateChange={tableQuery.setState}
          getRowId={(row) => row.id}
          emptyTitle={t("noExportsYet")}
          emptyDescription={t("noExportsHint")}
          pagination={{
            page: logsPage,
            perPage: logsPerPage,
            total: logsMeta.total,
            onPageChange: setLogsPage,
            onPerPageChange: (size) => {
              setLogsPerPage(size);
              setLogsPage(1);
            },
          }}
        />
      </section>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={t("deleteArchive")}
        description={t("deleteArchiveConfirm")}
        confirmLabel={tCommon("delete")}
        variant="destructive"
        onConfirm={async () => {
          if (pendingDeleteId === null) return;
          await deleteArchive(pendingDeleteId);
        }}
      />
    </div>
  );
}
