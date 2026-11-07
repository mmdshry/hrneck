"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Pagination } from "@/components/ui/pagination";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  paginateLocal,
  type PageSize,
} from "@/lib/pagination";
import { resolveTenant } from "@/lib/tenant";

type Integration = {
  id: string;
  name: string;
  status: string;
  details: Record<string, string | number | null | undefined>;
};

type IntegrationsPayload = {
  data: Integration[];
};

export function IntegrationsClient() {
  const tenant = resolveTenant();
  const [rows, setRows] = useState<Integration[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  const channel = useMemo(() => `org.${tenant}.integrations`, [tenant]);

  const onPayload = useCallback((payload: IntegrationsPayload) => {
    setRows(Array.isArray(payload.data) ? payload.data : []);
  }, []);

  const refreshFromApi = useCallback(async () => {
    await ensureCsrf();
    const res = await api<IntegrationsPayload>("/api/v1/org/integrations", {
      tenant: resolveTenant(),
    });
    setRows(Array.isArray(res.data) ? res.data : []);
  }, []);

  const { status, error } = useLiveTopic<IntegrationsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    void refreshFromApi()
      .catch(() => {
        /* live channel may still populate */
      })
      .finally(() => setLoading(false));
  }, [refreshFromApi]);

  const sliced = useMemo(() => paginateLocal(rows, page, perPage), [rows, page, perPage]);

  const statusLabel = liveStatusLabel(status);

  if (loading) {
    return <PageSkeleton className="max-w-3xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Integrations"
        description={statusLabel ?? "Live"}
        actions={
          <LinkButton href="/org/settings" variant="secondary">
            Settings
          </LinkButton>
        }
      />
      {error ? (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={status === "live" ? "No integrations" : "Connecting…"}
          description={
            status === "live"
              ? "Connect SMTP and other providers when credentials are configured."
              : (statusLabel ?? "Waiting for live data…")
          }
        />
      ) : (
        <>
          <ul className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {sliced.data.map((row) => (
              <li key={row.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{row.name}</p>
                  <span className="text-sm capitalize text-[var(--muted-foreground)]">
                    {row.status.replaceAll("_", " ")}
                  </span>
                </div>
                {row.id === "smtp" ? (
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    {String(row.details.host)}:{String(row.details.port)} · from{" "}
                    {String(row.details.from)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                    {String(row.details.message ?? "Coming when credentials provided")}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            className="mt-4"
            page={page}
            perPage={perPage}
            total={sliced.meta.total}
            onPageChange={setPage}
            onPerPageChange={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
