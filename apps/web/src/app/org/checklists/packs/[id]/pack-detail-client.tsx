"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { toastSuccess, toastError, toastInfo } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { paginationQuery } from "@/lib/pagination";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { ChecklistPack, ChecklistTemplate } from "../../checklist-types";

export function ChecklistPackDetailClient({ packId }: { packId: number }) {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const [session, setSession] = useState<SessionUser | null>(null);
  const [pack, setPack] = useState<ChecklistPack | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [autoAssign, setAutoAssign] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    const next = packRes.data;
    setPack(next);
    setName(next.name);
    setDescription(next.description ?? "");
    setStatus(next.status);
    setAutoAssign(Boolean(next.auto_assign_on_create));
    setSelectedTemplateIds(next.template_ids ?? []);
    setTemplates((tplRes.data ?? []).filter((row) => !row.is_system));
  }, [packId]);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [refresh, tCommon]);

  function toggleTemplate(id: number) {
    setSelectedTemplateIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function moveTemplate(id: number, direction: -1 | 1) {
    setSelectedTemplateIds((current) => {
      const index = current.indexOf(id);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (selectedTemplateIds.length === 0) {
      toastInfo(t("selectAtLeastOneTemplate"));
      return;
    }
    
    setSaving(true);
    try {
      await ensureCsrf();
      const res = await api<{ data: ChecklistPack }>(`/api/v1/org/checklists/packs/${packId}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status,
          auto_assign_on_create: autoAssign,
          template_ids: selectedTemplateIds,
        }),
      });
      setPack(res.data);
      toastSuccess(t("packSaved"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" />;
  }

  if (session && !hasPermission(session, "org.checklists.manage")) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title={t("checklistPack")} />
        <EmptyState title={t("needEditPacks")} />
      </div>
    );
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

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={pack.name}
        description={t("editPackMembership")}
        actions={
          <LinkButton href="/org/checklists/packs" variant="secondary">
            {t("allPacks")}
          </LinkButton>
        }
      />

      

      <Panel className="p-4">
        <form onSubmit={(e) => void onSave(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pack-edit-name">{tCommon("name")}</Label>
            <Input
              id="pack-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-edit-desc">{tCommon("descriptionLabel")}</Label>
            <Textarea
              id="pack-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-edit-status">{tCommon("status")}</Label>
            <Select
              id="pack-edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">{tCommon("draft")}</option>
              <option value="published">{tCommon("published")}</option>
              <option value="archived">{tCommon("archived")}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tCommon("templates")}</Label>
            <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
              {templates.map((template) => {
                const selected = selectedTemplateIds.includes(template.id);
                const order = selectedTemplateIds.indexOf(template.id);
                return (
                  <div
                    key={template.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleTemplate(template.id)}
                      />
                      <span>
                        {template.name}
                        {selected ? ` · #${order + 1}` : ""}
                      </span>
                    </label>
                    {selected ? (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => moveTemplate(template.id, -1)}
                        >
                          {t("moveUp")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => moveTemplate(template.id, 1)}
                        >
                          {t("moveDown")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
            />
            {t("autoAssignOnCreate")}
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? tCommon("saving") : t("savePack")}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
