"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { toastError } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery } from "@/lib/pagination";
import { hasAnyPermission, hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { ChecklistPack, ChecklistTemplate } from "../checklist-types";
import { CreatePackWizard } from "./create-pack-wizard";

export function ChecklistPacksClient() {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const [session, setSession] = useState<SessionUser | null>(null);
  const canManageChecklists = hasPermission(session, "org.checklists.manage");
  const [packs, setPacks] = useState<ChecklistPack[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;
    const t = resolveTenant();
    const [packRes, tplRes] = await Promise.all([
      api<{ data: ChecklistPack[] }>(
        `/api/v1/org/checklists/packs?${paginationQuery(1, 100)}`,
        { tenant: t },
      ),
      api<{ data: ChecklistTemplate[] }>(
        `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
        { tenant: t },
      ),
    ]);
    setPacks(packRes.data ?? []);
    setTemplates((tplRes.data ?? []).filter((row) => !row.is_system));
  }, []);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [refresh, tCommon]);

  const columns: Array<DataTableColumn<ChecklistPack>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (pack) => pack.name,
    },
    {
      id: "status",
      header: tCommon("status"),
      accessorKey: "status",
      cell: (pack) => pack.status,
    },
    {
      id: "templates",
      header: tCommon("templates"),
      filter: "none",
      enableSorting: false,
      cell: (pack) => pack.template_ids?.length ?? pack.templates?.length ?? 0,
    },
    {
      id: "auto",
      header: t("autoOnHire"),
      filter: "none",
      enableSorting: false,
      cell: (pack) => (pack.auto_assign_on_create ? tCommon("yes") : tCommon("no")),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (pack) => (
        <LinkButton href={`/org/checklists/packs/${pack.id}`} variant="outline" size="compact">
          {tCommon("edit")}
        </LinkButton>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasAnyPermission(session, ["org.checklists.view", "org.checklists.manage"])) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("packsTitle")} />
        <EmptyState title={t("needManagePacks")} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("packsTitle")}
        description={t("packsDescription")}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/checklists" variant="secondary">
              {t("templates")}
            </LinkButton>
            <LinkButton href="/org/checklists/instances" variant="secondary">
              {t("instances")}
            </LinkButton>
            {canManageChecklists ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                {t("newPack")}
              </Button>
            ) : null}
          </div>
        }
      />

      {createOpen ? (
        <CreatePackWizard templates={templates} onClose={() => setCreateOpen(false)} />
      ) : null}

      <DataTable
        mode="client"
        caption={t("packsCaption")}
        columns={columns}
        rows={packs}
        getRowId={(row) => row.id}
        emptyTitle={t("noPacksYet")}
        emptyDescription={t("createPackHint")}
      />
    </div>
  );
}
