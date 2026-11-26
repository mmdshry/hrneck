"use client";

import { useCallback, useEffect, useState } from "react";
import { toastError } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { ChecklistPack, ChecklistTemplate } from "../../checklist-types";
import { PackEditDialog } from "./pack-edit-dialog";

export function ChecklistPackDetailClient({ packId }: { packId: number }) {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const [session, setSession] = useState<SessionUser | null>(null);
  const canManageChecklists = hasPermission(session, "org.checklists.manage");
  const [pack, setPack] = useState<ChecklistPack | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;
    const tenantId = resolveTenant();
    const [packRes, tplRes] = await Promise.all([
      api<{ data: ChecklistPack }>(`/api/v1/org/checklists/packs/${packId}`, { tenant: tenantId }),
      api<{ data: ChecklistTemplate[] }>(
        `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
        { tenant: tenantId },
      ),
    ]);
    setPack(packRes.data);
    setTemplates((tplRes.data ?? []).filter((row) => !row.is_system));
  }, [packId]);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [refresh, tCommon]);

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (!pack) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("checklistPack")} description={t("packNotFound")} />

        <LinkButton href="/org/checklists/packs" variant="secondary">
          {t("backToPacks")}
        </LinkButton>
      </div>
    );
  }

  const packTemplates = pack.templates ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={pack.name}
        description={t("editPackMembership")}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/checklists/packs" variant="secondary">
              {t("allPacks")}
            </LinkButton>
            {canManageChecklists ? (
              <Button type="button" onClick={() => setEditOpen(true)}>
                {t("editPack")}
              </Button>
            ) : null}
          </div>
        }
      />

      <Panel className="space-y-4 p-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-[var(--muted-foreground)]">{tCommon("status")}</dt>
          <dd>{pack.status}</dd>
          <dt className="text-[var(--muted-foreground)]">{tCommon("descriptionLabel")}</dt>
          <dd>{pack.description || tCommon("emDash")}</dd>
          <dt className="text-[var(--muted-foreground)]">{t("autoOnHire")}</dt>
          <dd>{pack.auto_assign_on_create ? tCommon("yes") : tCommon("no")}</dd>
        </dl>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t("templatesOrder")}</h2>
          {packTemplates.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">{tCommon("none")}</p>
          ) : (
            <ol className="list-decimal space-y-1 ps-5 text-sm">
              {packTemplates.map((template) => (
                <li key={template.id}>{template.name}</li>
              ))}
            </ol>
          )}
        </div>
      </Panel>

      {editOpen ? (
        <PackEditDialog
          pack={pack}
          templates={templates}
          onSaved={setPack}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  );
}
