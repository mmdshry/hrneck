"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Pagination } from "@/components/ui/pagination";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
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

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (
    /\b(fail|failed|error|invalid|unauthorized|rejected)\b/.test(m) ||
    m.includes("load failed") ||
    m.includes("generate failed") ||
    m.includes("download failed")
  ) {
    return "destructive";
  }
  if (m.includes("generated") || m.includes("downloaded")) {
    return "success";
  }
  return "default";
}

export function ReportExportClient() {
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
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const channel = useMemo(() => `org.${tenant}.reports-export`, [tenant]);

  const applyLogSlice = useCallback(
    (items: Archive[], nextPage: number, nextPerPage: number) => {
      const sliced = paginateLocal(items, nextPage, nextPerPage);
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
    async (nextPage = logsPage, nextPerPage = logsPerPage) => {
      await ensureCsrf();
      const t = resolveTenant();
      const [archives, cal] = await Promise.all([
        api(`/api/v1/org/reports/export?${paginationQuery(nextPage, nextPerPage)}`, { tenant: t }),
        api<{ data: Calendar }>("/api/v1/org/reports/export/calendar", { tenant: t }),
      ]);
      applyExportState(cal.data ?? null, null, false);
      const parsed = parsePaginatedResponse<Archive>(archives, nextPerPage);
      setLogs(parsed.data);
      setLogsMeta(parsed.meta);
      setLogsPage(parsed.meta.current_page);
    },
    [applyExportState, logsPage, logsPerPage],
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
    if (allLogs !== null) {
      applyLogSlice(allLogs, logsPage, logsPerPage);
      return;
    }
    void refreshFromApi(logsPage, logsPerPage).catch((err: unknown) => {
      setMessage(err instanceof Error ? err.message : "Load failed");
    });
  }, [allLogs, logsPage, logsPerPage, applyLogSlice, refreshFromApi]);

  const statusLabel = liveStatusLabel(status);

  async function generate(scope: "business" | "user", key: string, periodType: string) {
    setMessage(null);
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
      await refreshFromApi(logsPage, logsPerPage);
      setMessage(`Generated ${scope} report for ${key}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Generate failed");
    }
  }

  async function onUserGenerate(event: FormEvent) {
    event.preventDefault();
    if (!periodKey) return;
    const periodType = periodKey.includes("-Q") ? "quarterly" : "monthly";
    await generate("user", periodKey, periodType);
  }

  async function download(id: number, key: string) {
    setMessage(null);
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
      setMessage(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function deleteArchive(id: number) {
    setMessage(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/reports/export/${id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setAllLogs(null);
      await refreshFromApi(logsPage, logsPerPage);
      setMessage("Archive deleted.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
      throw err;
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Report export"
        description="Business rollup and user-filtered PDF archives (six-section quarterly)."
        actions={
          <span className="text-sm text-[var(--muted-foreground)]">
            {statusLabel ?? "Live"}
          </span>
        }
      />
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Export mode">
        {(["business", "user"] as const).map((t) => (
          <Button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? "default" : "secondary"}
            onClick={() => setTab(t)}
          >
            {t === "business" ? "Business" : "User"}
          </Button>
        ))}
      </div>
      {message ? (
        <Alert className="mt-4" variant={alertVariantForMessage(message)}>
          {message}
        </Alert>
      ) : null}
      {liveError ? (
        <Alert className="mt-4" variant="destructive">
          {liveError}
        </Alert>
      ) : null}
      {tab === "business" && calendar ? (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-xl font-medium text-[var(--foreground)]">Monthly</h2>
            {calendar.months.length === 0 ? (
              <EmptyState
                className="mt-4"
                title="No months in calendar"
                description="Periods appear when the export calendar is available."
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
                          Download
                        </Button>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">Unavailable</span>
                      )}
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-xl font-medium text-[var(--foreground)]">Quarterly</h2>
            {calendar.quarters.length === 0 ? (
              <EmptyState
                className="mt-4"
                title="No quarters in calendar"
                description="Periods appear when the export calendar is available."
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
                          PDF
                        </Button>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">Unavailable</span>
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
        <MinimalLoader className="mt-8" label={statusLabel ?? "Loading calendar"} />
      ) : null}
      {tab === "user" ? (
        <form onSubmit={onUserGenerate} className="mt-8 max-w-lg space-y-4">
          <div className="space-y-1">
            <Label htmlFor="export-period-key" className="text-[var(--muted-foreground)]">
              Period key
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
              Timezone
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
            Include training
          </label>
          <Button type="submit">Generate PDF</Button>
        </form>
      ) : null}
      <section className="mt-12">
        <h2 className="text-xl font-medium text-[var(--foreground)]">Report log</h2>
        {logs.length === 0 && logsMeta.total === 0 ? (
          <EmptyState
            className="mt-4"
            title="No exports yet"
            description="Generate a business or user report to see it listed here."
          />
        ) : (
          <>
            <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {logs.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {row.scope} · {row.period_key} · {row.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="link"
                      className="min-h-0 self-start px-0 sm:self-center"
                      onClick={() => void download(row.id, row.period_key)}
                    >
                      Download
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-0 px-2 py-1 text-xs"
                      onClick={() => setPendingDeleteId(row.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              className="mt-4"
              page={logsPage}
              perPage={logsPerPage}
              total={logsMeta.total}
              onPageChange={setLogsPage}
              onPerPageChange={(size) => {
                setLogsPerPage(size);
                setLogsPage(1);
              }}
            />
          </>
        )}
      </section>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete report archive"
        description="Delete this report archive?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (pendingDeleteId === null) return;
          await deleteArchive(pendingDeleteId);
        }}
      />
    </div>
  );
}
