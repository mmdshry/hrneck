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
import { toastError, toastSuccess } from "@/lib/toast";
import type { ChecklistTemplate } from "./checklist-types";

type CreateTemplateDialogProps = {
  onClose: () => void;
};

export function CreateTemplateDialog({ onClose }: CreateTemplateDialogProps) {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const formId = useId();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      const created = await api<{ data: ChecklistTemplate }>("/api/v1/org/checklists/templates", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          description: description || null,
          status: "draft",
          schema_json: { items: [] },
        }),
      });
      toastSuccess(t("templateCreated"));
      window.location.href = `/org/checklists/${created.data.id}`;
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("newTemplate")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {t("createAndDesign")}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(e) => void onCreate(e)} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cl-name">{tCommon("name")}</Label>
          <Input id="cl-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-cat">{tCommon("category")}</Label>
          <Select id="cl-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="onboarding">{t("onboarding")}</option>
            <option value="offboarding">{t("offboarding")}</option>
            <option value="hr_ops">{t("hrOps")}</option>
            <option value="custom">{t("custom")}</option>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cl-desc">{tCommon("descriptionLabel")}</Label>
          <Textarea
            id="cl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </form>
    </Dialog>
  );
}
