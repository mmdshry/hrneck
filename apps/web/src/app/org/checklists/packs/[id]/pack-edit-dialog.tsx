"use client";

import { FormEvent, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import type { ChecklistPack, ChecklistTemplate } from "../../checklist-types";
import { PackTemplatePicker } from "../pack-template-picker";

type PackEditDialogProps = {
  pack: ChecklistPack;
  templates: ChecklistTemplate[];
  onSaved: (pack: ChecklistPack) => void;
  onClose: () => void;
};

export function PackEditDialog({ pack, templates, onSaved, onClose }: PackEditDialogProps) {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const formId = useId();
  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState(pack.description ?? "");
  const [status, setStatus] = useState(pack.status);
  const [autoAssign, setAutoAssign] = useState(Boolean(pack.auto_assign_on_create));
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>(
    pack.template_ids ?? [],
  );
  const [saving, setSaving] = useState(false);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (selectedTemplateIds.length === 0) {
      toastInfo(t("selectAtLeastOneTemplate"));
      return;
    }

    setSaving(true);
    try {
      await ensureCsrf();
      const res = await api<{ data: ChecklistPack }>(`/api/v1/org/checklists/packs/${pack.id}`, {
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
      toastSuccess(t("packSaved"));
      onSaved(res.data);
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("editPack")}
      description={t("editPackMembership")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? tCommon("saving") : t("savePack")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void onSave(e)} className="space-y-4">
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
          <PackTemplatePicker
            templates={templates}
            selectedTemplateIds={selectedTemplateIds}
            onChange={setSelectedTemplateIds}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoAssign}
            onChange={(e) => setAutoAssign(e.target.checked)}
          />
          {t("autoAssignOnCreate")}
        </label>
      </form>
    </Dialog>
  );
}
