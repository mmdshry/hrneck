"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { toastSuccess, toastError } from "@/lib/toast";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type {
  ChecklistInstance,
  ChecklistPack,
  ChecklistTemplate,
} from "@/app/org/checklists/checklist-types";
import { TargetFormWizard } from "../target-form-wizard";
import { languageLabel, type Target } from "../target-types";
import { ConnectChecklistDialog } from "./connect-checklist-dialog";

function formatValue(
  value: string | number | boolean | null | undefined,
  yes: string,
  no: string,
  emDash: string,
): string {
  if (value === null || value === undefined || value === "") return emDash;
  if (typeof value === "boolean") return value ? yes : no;
  return String(value);
}

export function TargetDetailClient({ targetId }: { targetId: number }) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const statusOptions = [
    { label: tCommon("notStarted"), value: "not_started" },
    { label: tCommon("inProgress"), value: "in_progress" },
    { label: tCommon("completed"), value: "completed" },
    { label: tCommon("cancelled"), value: "cancelled" },
  ];
  const [session, setSession] = useState<SessionUser | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [packs, setPacks] = useState<ChecklistPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const canManageChecklists = hasPermission(session, "org.checklists.manage");
  const fv = (value: string | number | boolean | null | undefined) =>
    formatValue(value, tCommon("yes"), tCommon("no"), tCommon("emDash"));

  const refresh = useCallback(async () => {
    await ensureCsrf();
    const me = await fetchSessionUser();
    setSession(me);
    if (!me) return;

    const tenantSlug = resolveTenant();
    const targetRes = await api<{ data: Target }>(`/api/v1/org/targets/${targetId}`, {
      tenant: tenantSlug,
    });
    setTarget(targetRes.data);

    if (hasPermission(me, "org.checklists.manage")) {
      const [instRes, tplRes, packRes] = await Promise.all([
        api<{ data: ChecklistInstance[] }>(
          `/api/v1/org/checklists/instances?${paginationQuery(1, 100, {
            target_id: String(targetId),
          })}`,
          { tenant: tenantSlug },
        ),
        api<{ data: ChecklistTemplate[] }>(
          `/api/v1/org/checklists/templates?${paginationQuery(1, 100, { editable_only: 1 })}`,
          { tenant: tenantSlug },
        ),
        api<{ data: ChecklistPack[] }>(
          `/api/v1/org/checklists/packs?${paginationQuery(1, 100)}`,
          { tenant: tenantSlug },
        ),
      ]);
      setInstances(instRes.data ?? []);
      const editable = (tplRes.data ?? []).filter((row) => !row.is_system);
      setTemplates(editable);
      const publishedPacks = (packRes.data ?? []).filter((row) => row.status !== "archived");
      setPacks(publishedPacks);
    } else {
      setInstances([]);
      setTemplates([]);
      setPacks([]);
    }
  }, [targetId]);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  async function recalculateRisk() {
    
    setSaving(true);
    try {
      await ensureCsrf();
      const res = await api<{ data: Target }>(`/api/v1/org/targets/${targetId}/recalculate-risk`, {
        method: "POST",
        tenant: resolveTenant(),
      });
      setTarget(res.data);
      toastSuccess(
        t("riskRecalculated", {
          score: res.data.risk_score ?? 0,
          tier: res.data.risk_tier ?? "unknown",
        }),
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("riskRecalcFailed"));
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<ChecklistInstance>> = [
    {
      id: "title",
      header: tCommon("template"),
      accessorKey: "title",
      sticky: true,
      cell: (row) => row.title,
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
      id: "progress",
      header: tCommon("progress"),
      filter: "none",
      enableSorting: false,
      cell: (row) => `${row.progress_pct}%`,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <LinkButton
          href={`/org/checklists/instances/${row.id}`}
          variant="outline"
          size="compact"
        >
          {tCommon("fillReview")}
        </LinkButton>
      ),
    },
  ];

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (!target) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={tCommon("employee")} description={t("employeeNotFound")} />
        
        <LinkButton href="/org/targets" variant="secondary">
          {t("backToEmployees")}
        </LinkButton>
      </div>
    );
  }

  const displayName = [target.first_name, target.last_name].filter(Boolean).join(" ").trim();
  const managerLabel = target.manager
    ? [target.manager.first_name, target.manager.last_name].filter(Boolean).join(" ").trim() ||
      target.manager.email
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={displayName || target.email}
        description={`${target.email}${target.department ? ` · ${target.department}` : ""}${
          target.status ? ` · ${target.status}` : ""
        }`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)}>
              {tCommon("edit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void recalculateRisk()}
            >
              {t("recalculateRisk")}
            </Button>
            <LinkButton href="/org/targets" variant="secondary">
              {t("employeesCaption")}
            </LinkButton>
          </div>
        }
      />

      <Panel className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">{tCommon("details")}</h2>
        <div className="mb-3">
          <AvatarUploader
            name={[target.first_name, target.last_name].filter(Boolean).join(" ")}
            email={target.email}
            avatarUrl={target.avatar_url}
            endpoint={`/api/v1/org/targets/${target.id}/avatar`}
            withTenant
            size="md"
            onChanged={(url) => setTarget((prev) => (prev ? { ...prev, avatar_url: url } : prev))}
          />
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("email")}</dt>
            <dd>{target.email}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("titleLabel")}</dt>
            <dd>{fv(target.job_title)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("department")}</dt>
            <dd>{fv(target.department)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("manager")}</dt>
            <dd>{fv(managerLabel)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("hireDate")}</dt>
            <dd>{fv(target.hire_date ? String(target.hire_date).slice(0, 10) : null)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("employeeNumber")}</dt>
            <dd>{fv(target.employee_number)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("phone")}</dt>
            <dd>{fv(target.phone)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("location")}</dt>
            <dd>{fv(target.location)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{t("employmentType")}</dt>
            <dd>{fv(target.employment_type)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{t("preferredLanguage")}</dt>
            <dd>{languageLabel(target.preferred_language)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("status")}</dt>
            <dd>{fv(target.status)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("externalId")}</dt>
            <dd>{fv(target.external_id)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{tCommon("risk")}</dt>
            <dd>
              {target.risk_score ?? 0}
              {target.risk_tier ? ` · ${target.risk_tier}` : ""}
              {target.risk_source ? ` (${target.risk_source})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{t("lastTrainingCompleted")}</dt>
            <dd>{fv(target.last_training_completed_at)}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{t("notificationOptOut")}</dt>
            <dd>{fv(Boolean(target.notification_opt_out))}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted-foreground)]">{t("joinedViaUserLink")}</dt>
            <dd>
              {fv(target.joined_via)}
              {target.user_id != null ? ` · ${t("userHash", { id: target.user_id })}` : ""}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[var(--muted-foreground)]">{tCommon("groups")}</dt>
            <dd>
              {target.groups?.length
                ? target.groups.map((group) => group.name).join(", ")
                : tCommon("emDash")}
            </dd>
          </div>
        </dl>
      </Panel>

      {canManageChecklists ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-medium text-[var(--foreground)]">{t("connectedChecklists")}</h2>
              <Button type="button" variant="secondary" onClick={() => setConnectOpen(true)}>
                {t("connectChecklist")}
              </Button>
            </div>
            <DataTable
              mode="client"
              caption={t("connectedChecklists")}
              columns={columns}
              rows={instances}
              getRowId={(row) => row.id}
              emptyTitle={t("noChecklistsYet")}
              emptyDescription={t("noChecklistsHint")}
            />
          </section>

          {connectOpen ? (
            <ConnectChecklistDialog
              targetId={targetId}
              templates={templates}
              packs={packs}
              onClose={() => setConnectOpen(false)}
              onConnected={refresh}
            />
          ) : null}
        </>
      ) : (
        <EmptyState title={t("checklistPermissionNeeded")} />
      )}

      {editOpen ? (
        <TargetFormWizard
          target={target}
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => setTarget(saved)}
        />
      ) : null}
    </div>
  );
}
