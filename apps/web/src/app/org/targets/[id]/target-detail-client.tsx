"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { toastSuccess, toastError } from "@/lib/toast";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { LocationSelect } from "@/components/ui/location-select";
import { Select } from "@/components/ui/select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { parsePaginatedResponse, paginationQuery } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type {
  ChecklistInstance,
  ChecklistPack,
  ChecklistTemplate,
} from "@/app/org/checklists/checklist-types";
import {
  EMPLOYMENT_TYPE_OPTIONS,
  PREFERRED_LANGUAGE_OPTIONS,
  emptyTargetForm,
  formFromTarget,
  languageLabel,
  payloadFromForm,
  type DepartmentOption,
  type Target,
  type TargetFormState,
} from "../target-types";

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
  const tChecklists = useTranslations("org.checklists");
  const statusOptions = [
    { label: tCommon("notStarted"), value: "not_started" },
    { label: tCommon("inProgress"), value: "in_progress" },
    { label: tCommon("completed"), value: "completed" },
    { label: tCommon("cancelled"), value: "cancelled" },
  ];
  const profileStatusOptions = [
    { label: tCommon("active"), value: "active" },
    { label: tCommon("inactive"), value: "inactive" },
  ];
  const [session, setSession] = useState<SessionUser | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [packs, setPacks] = useState<ChecklistPack[]>([]);
  const [assignMode, setAssignMode] = useState<"template" | "pack">("template");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [packId, setPackId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<TargetFormState>(emptyTargetForm());
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [managerOptions, setManagerOptions] = useState<Target[]>([]);

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
      setTemplateId((current) => current || editable[0]?.id || "");
      setPackId((current) => current || publishedPacks[0]?.id || "");
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

  async function openEdit() {
    if (!target) return;
    setForm(formFromTarget(target));
    setEditOpen(true);
    const tenantSlug = resolveTenant();
    try {
      const [deptRes, mgrRes] = await Promise.all([
        api(`/api/v1/org/departments?${paginationQuery(1, 500, { active_only: "1" })}`, {
          tenant: tenantSlug,
        }),
        api(`/api/v1/org/targets?${paginationQuery(1, 500)}`, { tenant: tenantSlug }),
      ]);
      const depts = parsePaginatedResponse<DepartmentOption>(deptRes, 500);
      const mgrs = parsePaginatedResponse<Target>(mgrRes, 500);
      setDepartments(depts.data.filter((department) => department.is_active !== false));
      setManagerOptions(mgrs.data);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("failedEditOptions"));
    }
  }

  function patchForm<K extends keyof TargetFormState>(key: K, value: TargetFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    
    setSaving(true);
    try {
      await ensureCsrf();
      const res = await api<{ data: Target }>(`/api/v1/org/targets/${targetId}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form, { includeStatus: true })),
      });
      setTarget(res.data);
      setEditOpen(false);
      toastSuccess(t("employeeUpdated"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

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
        `Risk recalculated: ${res.data.risk_score ?? 0} (${res.data.risk_tier ?? "unknown"}).`,
      );
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("riskRecalcFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    
    setSaving(true);
    try {
      await ensureCsrf();
      const tenantSlug = resolveTenant();
      if (assignMode === "pack") {
        if (!packId) return;
        await api(`/api/v1/org/checklists/packs/${packId}/assign`, {
          method: "POST",
          tenant: tenantSlug,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_ids: [targetId] }),
        });
        toastSuccess(t("welcomePackConnected"));
      } else {
        if (!templateId) return;
        await api("/api/v1/org/checklists/instances", {
          method: "POST",
          tenant: tenantSlug,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            target_ids: [targetId],
          }),
        });
        toastSuccess(t("checklistConnected"));
      }
      await refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("assignFailed"));
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
          Back to employees
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
            <Button type="button" variant="secondary" onClick={() => void openEdit()}>
              Edit
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
            <dt className="text-[var(--muted-foreground)]">{t("preferredLanguage")} / {tCommon("timezone")}</dt>
            <dd>
              {languageLabel(target.preferred_language)}
              {target.timezone ? ` · ${target.timezone}` : ""}
            </dd>
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
          <Panel className="space-y-4 p-4">
            <h2 className="text-sm font-semibold">{t("connectChecklist")}</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("connectChecklistHint")}
            </p>
            <form onSubmit={(e) => void onAssign(e)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="assign-mode">{tChecklists("assign")}</Label>
                <Select
                  id="assign-mode"
                  value={assignMode}
                  onChange={(e) => setAssignMode(e.target.value as "template" | "pack")}
                >
                  <option value="template">{tChecklists("singleTemplate")}</option>
                  <option value="pack">{tChecklists("checklistPack")}</option>
                </Select>
              </div>
              {assignMode === "pack" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="assign-pack">{tCommon("pack")}</Label>
                  <Select
                    id="assign-pack"
                    value={packId === "" ? "" : String(packId)}
                    onChange={(e) => setPackId(e.target.value ? Number(e.target.value) : "")}
                    required
                  >
                    <option value="">{tChecklists("selectPack")}</option>
                    {packs.map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        {pack.name}
                        {pack.auto_assign_on_create ? " (auto on hire)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="assign-template">{tCommon("template")}</Label>
                  <Select
                    id="assign-template"
                    value={templateId === "" ? "" : String(templateId)}
                    onChange={(e) =>
                      setTemplateId(e.target.value ? Number(e.target.value) : "")
                    }
                    required
                  >
                    <option value="">{tChecklists("selectTemplate")}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? tCommon("connecting") : t("connectToEmployee")}
              </Button>
            </form>
          </Panel>

          <section className="space-y-3">
            <h2 className="text-xl font-medium text-[var(--foreground)]">{t("connectedChecklists")}</h2>
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
        </>
      ) : (
        <EmptyState title={"You need org.checklists.manage to view and connect checklists."} />
      )}

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!saving) setEditOpen(open);
        }}
        title={t("editEmployee")}
        description={t("editEmployeeDescription")}
        dismissible={!saving}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="target-detail-edit-form"
              disabled={saving || !form.email.trim() || !form.timezone.trim()}
            >
              {saving ? tCommon("saving") : tCommon("saveChanges")}
            </Button>
          </>
        }
      >
        <form
          id="target-detail-edit-form"
          onSubmit={(e) => void saveEdit(e)}
          className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
        >
          <div className="space-y-1">
            <Label htmlFor="detail-email">{tCommon("email")}</Label>
            <Input
              id="detail-email"
              type="email"
              value={form.email}
              onChange={(e) => patchForm("email", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="detail-first-name">{tCommon("firstName")}</Label>
              <Input
                id="detail-first-name"
                value={form.first_name}
                onChange={(e) => patchForm("first_name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-last-name">{tCommon("lastName")}</Label>
              <Input
                id="detail-last-name"
                value={form.last_name}
                onChange={(e) => patchForm("last_name", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="detail-job-title">{tCommon("titleLabel")}</Label>
              <Input
                id="detail-job-title"
                value={form.job_title}
                onChange={(e) => patchForm("job_title", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-department">{tCommon("department")}</Label>
              <Select
                id="detail-department"
                value={form.department_id}
                onChange={(e) => patchForm("department_id", e.target.value)}
              >
                <option value="">{t("noDepartment")}</option>
                {departments.map((department) => (
                  <option key={department.id} value={String(department.id)}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="detail-manager">{tCommon("manager")}</Label>
              <Select
                id="detail-manager"
                value={form.manager_target_id}
                onChange={(e) => patchForm("manager_target_id", e.target.value)}
              >
                <option value="">{t("noManager")}</option>
                {managerOptions
                  .filter((row) => row.id !== targetId)
                  .map((row) => (
                    <option key={row.id} value={String(row.id)}>
                      {[row.first_name, row.last_name].filter(Boolean).join(" ") || row.email} ({row.email})
                    </option>
                  ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-employment-type">{t("employmentType")}</Label>
              <Select
                id="detail-employment-type"
                value={form.employment_type}
                onChange={(e) => patchForm("employment_type", e.target.value)}
              >
                <option value="">{t("notSet")}</option>
                {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="detail-hire-date">{tCommon("hireDate")}</Label>
              <Input
                id="detail-hire-date"
                type="date"
                value={form.hire_date}
                onChange={(e) => patchForm("hire_date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-employee-number">{tCommon("employeeNumber")}</Label>
              <Input
                id="detail-employee-number"
                value={form.employee_number}
                onChange={(e) => patchForm("employee_number", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="detail-phone">{tCommon("phone")}</Label>
              <Input
                id="detail-phone"
                value={form.phone}
                onChange={(e) => patchForm("phone", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-location">{tCommon("location")}</Label>
              <LocationSelect
                id="detail-location"
                value={form.location}
                onChange={(next) => patchForm("location", next)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="detail-language">{t("preferredLanguage")}</Label>
              <Select
                id="detail-language"
                value={form.preferred_language}
                onChange={(e) => patchForm("preferred_language", e.target.value)}
              >
                <option value="">{t("notSet")}</option>
                {PREFERRED_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-timezone">{tCommon("timezone")}</Label>
              <TimezoneSelect
                id="detail-timezone"
                value={form.timezone}
                onChange={(e) => patchForm("timezone", e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="detail-external-id">{tCommon("externalId")}</Label>
              <Input
                id="detail-external-id"
                value={form.external_id}
                onChange={(e) => patchForm("external_id", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="detail-status">{tCommon("status")}</Label>
              <Select
                id="detail-status"
                value={form.status}
                onChange={(e) => patchForm("status", e.target.value)}
              >
                {profileStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.notification_opt_out}
              onChange={(e) => patchForm("notification_opt_out", e.target.checked)}
            />
            {t("optOutCampaignNotifications")}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
