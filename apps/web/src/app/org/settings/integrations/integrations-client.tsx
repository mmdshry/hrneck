"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf } from "@/lib/api";
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

const STATUS_OPTIONS = [
  { label: "Connected", value: "connected" },
  { label: "Disconnected", value: "disconnected" },
  { label: "Coming soon", value: "coming_soon" },
];

function detailsText(row: Integration): string {
  if (row.id === "smtp") {
    return `${String(row.details.host)}:${String(row.details.port)} · from ${String(row.details.from)}`;
  }
  return String(row.details.message ?? "Coming when credentials provided");
}

export function IntegrationsClient() {
  const tenant = resolveTenant();
  const [rows, setRows] = useState<Integration[]>([]);
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

  const statusLabel = liveStatusLabel(status);

  const columns: Array<DataTableColumn<Integration>> = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "status",
      header: "Status",
      filter: "select",
      filterOptions: STATUS_OPTIONS,
      filterValue: (row) => row.status,
      cell: (row) => row.status.replaceAll("_", " "),
    },
    {
      id: "details",
      header: "Details",
      filterValue: (row) => detailsText(row),
      enableSorting: false,
      cell: (row) => detailsText(row),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
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
      <DataTable
        className="mt-8"
        mode="client"
        caption="Integrations"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        emptyTitle={status === "live" ? "No integrations" : "Connecting…"}
        emptyDescription={
          status === "live"
            ? "Connect SMTP and other providers when credentials are configured."
            : (statusLabel ?? "Waiting for live data…")
        }
      />
    </div>
  );
}
