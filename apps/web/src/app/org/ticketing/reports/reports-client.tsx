"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import {
  captureElementPng,
  downloadAuthenticated,
} from "@/lib/download";
import { orgLiveChannel } from "@/lib/live-topics";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";

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
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "ticketing-reports") : null;
  const [session, setSession] = useState<SessionUser | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    const t = resolveTenant();
    const res = await api<{ data: Summary }>(
      "/api/v1/org/ticketing/reports/summary",
      { tenant: t },
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
    if (liveReady) {
      setLoading(false);
      return;
    }
    void refreshFromApi()
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [liveReady, refreshFromApi]);

  const statusLabel = liveStatusLabel(status);

  async function exportReport(format: "csv" | "pdf" | "png") {
    setMessage(null);
    setExporting(format);
    try {
      if (format === "png") {
        const el = reportRef.current;
        if (!el) throw new Error("Report panel not ready");
        await captureElementPng(el, "ticketing-report.png");
        setMessage("Ticketing report PNG downloaded.");
        return;
      }

      const path =
        format === "csv"
          ? "/api/v1/org/ticketing/reports/csv"
          : "/api/v1/org/ticketing/reports/pdf";
      const accept = format === "csv" ? "text/csv" : "application/pdf";
      await downloadAuthenticated(path, `ticketing-report.${format}`, accept);
      setMessage(`Ticketing report ${format.toUpperCase()} downloaded.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Export failed");
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
        <PageHeader title="Ticketing reports" description="SLA and volume." />
        <Alert>You need org.ticketing.reports.</Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title="Ticketing reports"
        description={
          statusLabel
            ? `Open volume and SLA attainment. · ${statusLabel}`
            : "Open volume and SLA attainment."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void exportReport("csv")}
            >
              {exporting === "csv" ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void exportReport("pdf")}
            >
              {exporting === "pdf" ? "Exporting…" : "Export PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting !== null}
              onClick={() => void exportReport("png")}
            >
              {exporting === "png" ? "Exporting…" : "Export PNG"}
            </Button>
            <LinkButton href="/org/ticketing" variant="outline">
              Queue
            </LinkButton>
          </div>
        }
      />
      {message ? <Alert>{message}</Alert> : null}
      {liveError ? <Alert variant="destructive">{liveError}</Alert> : null}
      <div ref={reportRef} className="space-y-4">
        <h2 className="text-lg font-medium">Ticketing summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel title="Open">
            {summary ? <div className="text-3xl font-semibold">{summary.total_open}</div> : "—"}
          </Panel>
          <Panel title="Resolved">
            {summary ? <div className="text-3xl font-semibold">{summary.total_resolved}</div> : "—"}
          </Panel>
          <Panel title="Response breach">
            {summary ? (
              <div className="text-3xl font-semibold">{summary.sla_response_breached}</div>
            ) : (
              "—"
            )}
          </Panel>
          <Panel title="Resolve breach">
            {summary ? (
              <div className="text-3xl font-semibold">{summary.sla_resolve_breached}</div>
            ) : (
              "—"
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
