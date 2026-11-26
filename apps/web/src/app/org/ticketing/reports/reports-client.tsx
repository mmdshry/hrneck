"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  captureElementPng,
  downloadAuthenticated,
} from "@/lib/download";
import { orgLiveChannel } from "@/lib/live-topics";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";

type Summary = {
  total_open: number;
  total_resolved: number;
  sla_response_breached: number;
  sla_resolve_breached: number;
};

type TicketingReportsPayload = {
  summary: Summary;
};

export function ReportsClient() {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "ticketing-reports") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | "png" | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  const onPayload = useCallback((payload: TicketingReportsPayload) => {
    if (payload.summary) {
      setSummary(payload.summary);
      setLiveReady(true);
    }
  }, []);

  const refreshFromApi = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) {
      return;
    }
    const tenantId = resolveTenant();
    const res = await api<{ data: Summary }>(
      "/api/v1/org/ticketing/reports/summary",
      { tenant: tenantId },
    );
    setSummary(res.data);
  }, []);

  const { status, error: liveError } = useLiveTopic<TicketingReportsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void fetchSessionUser()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    if (
      session &&
      !hasPermission(session, "org.ticketing.reports")
    ) {
      toastError(t("needReportsPermission"));
    }
  }, [session, t]);

  useEffect(() => {
    if (liveReady) {
      setLoading(false);
      return;
    }
    void refreshFromApi()
      .catch((err: unknown) =>
        toastError(err instanceof Error ? err.message : tCommon("loadFailed")),
      )
      .finally(() => setLoading(false));
  }, [liveReady, refreshFromApi, tCommon]);

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);
  const dash = tCommon("emDash");

  async function exportReport(format: "csv" | "pdf" | "png") {
    setExporting(format);
    try {
      if (format === "png") {
        const el = reportRef.current;
        if (!el) throw new Error(t("reportPanelNotReady"));
        await captureElementPng(el, "ticketing-report.png");
        toastSuccess(t("reportPngDownloaded"));
        return;
      }

      const path =
        format === "csv"
          ? "/api/v1/org/ticketing/reports/csv"
          : "/api/v1/org/ticketing/reports/pdf";
      const accept = format === "csv" ? "text/csv" : "application/pdf";
      const result = await downloadAuthenticated(path, `ticketing-report.${format}`, accept);
      toastSuccess(t("reportDownloaded", { format: format.toUpperCase() }));
      if (result.truncated) {
        toastWarning(t("reportTruncated"));
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("exportFailed"));
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.ticketing.reports")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("reportsTitle")} description={t("reportsDescription")} />
        <EmptyState title={t("needReportsPermission")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("reportsTitle")}
        description={
          statusLabel
            ? `${t("reportsDescription")} · ${statusLabel}`
            : t("reportsDescription")
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void exportReport("csv")}
            >
              {exporting === "csv" ? tCommon("exporting") : tCommon("exportCsv")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void exportReport("pdf")}
            >
              {exporting === "pdf" ? tCommon("exporting") : tCommon("exportPdf")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void exportReport("png")}
            >
              {exporting === "png" ? tCommon("exporting") : tCommon("exportPng")}
            </Button>
            <LinkButton href="/org/ticketing" variant="outline">
              {t("queue")}
            </LinkButton>
          </div>
        }
      />
      <div ref={reportRef} className="space-y-4">
        <h2 className="text-lg font-medium">{t("ticketingSummary")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel title={tCommon("open")}>
            {summary ? <div className="text-3xl font-semibold">{summary.total_open}</div> : dash}
          </Panel>
          <Panel title={tCommon("resolved")}>
            {summary ? (
              <div className="text-3xl font-semibold">{summary.total_resolved}</div>
            ) : (
              dash
            )}
          </Panel>
          <Panel title={t("responseBreach")}>
            {summary ? (
              <div className="text-3xl font-semibold">{summary.sla_response_breached}</div>
            ) : (
              dash
            )}
          </Panel>
          <Panel title={t("resolveBreach")}>
            {summary ? (
              <div className="text-3xl font-semibold">{summary.sla_resolve_breached}</div>
            ) : (
              dash
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
