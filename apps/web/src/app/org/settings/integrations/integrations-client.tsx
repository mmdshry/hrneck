"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { liveStatusLabel, useLiveStatusLabels, useLiveTopic } from "@/hooks/use-live-topic";
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

export function IntegrationsClient() {
  const t = useTranslations("org.settings");
  const tCommon = useTranslations("common");
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

  const liveLabels = useLiveStatusLabels();
  const statusLabel = liveStatusLabel(status, liveLabels);

  const statusOptions = [
    { label: tCommon("connected"), value: "connected" },
    { label: tCommon("disconnected"), value: "disconnected" },
    { label: tCommon("comingSoon"), value: "coming_soon" },
  ];

  function detailsText(row: Integration): string {
    if (row.id === "smtp") {
      return t("smtpDetails", {
        host: String(row.details.host),
        port: String(row.details.port),
        from: String(row.details.from),
      });
    }
    return String(row.details.message ?? t("comingWhenCredentials"));
  }

  const columns: Array<DataTableColumn<Integration>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "status",
      header: tCommon("status"),
      filter: "select",
      filterOptions: statusOptions,
      filterValue: (row) => row.status,
      cell: (row) => row.status.replaceAll("_", " "),
    },
    {
      id: "details",
      header: tCommon("details"),
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
        title={t("integrationsTitle")}
        description={statusLabel ?? tCommon("live")}
        actions={
          <LinkButton href="/org/settings" variant="secondary">
            {t("title")}
          </LinkButton>
        }
      />
      
      <DataTable
        className="mt-8"
        mode="client"
        caption={t("integrationsTitle")}
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        emptyTitle={status === "live" ? t("noIntegrations") : tCommon("connecting")}
        emptyDescription={
          status === "live"
            ? t("integrationsEmptyHint")
            : (statusLabel ?? t("waitingLive"))
        }
      />
    </div>
  );
}
