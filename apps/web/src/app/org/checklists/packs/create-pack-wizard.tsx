"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import type { ChecklistPack, ChecklistTemplate } from "../checklist-types";
import { PackTemplatePicker } from "./pack-template-picker";

type CreatePackWizardProps = {
  templates: ChecklistTemplate[];
  onClose: () => void;
};

export function CreatePackWizard({ templates, onClose }: CreatePackWizardProps) {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const wizardLabels = useWizardLabels({ submit: t("createPack") });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [autoAssign, setAutoAssign] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedTemplates = selectedTemplateIds.flatMap((id) => {
    const template = templates.find((row) => row.id === id);
    return template ? [template] : [];
  });

  const steps: WizardStep[] = [
    {
      id: "details",
      title: tCommon("details"),
      validate: () => nameInputRef.current?.reportValidity() ?? false,
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pack-name">{tCommon("name")}</Label>
            <Input
              id="pack-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack-desc">{tCommon("descriptionLabel")}</Label>
            <Textarea
              id="pack-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      ),
    },
    {
      id: "templates",
      title: tCommon("templates"),
      validate: () => {
        if (selectedTemplateIds.length === 0) {
          toastInfo(t("selectAtLeastOneTemplate"));
          return false;
        }
        return true;
      },
      render: () => (
        <div className="space-y-2">
          <Label>{t("templatesOrder")}</Label>
          <PackTemplatePicker
            templates={templates}
            selectedTemplateIds={selectedTemplateIds}
            onChange={setSelectedTemplateIds}
          />
        </div>
      ),
    },
    {
      id: "review",
      title: t("reviewStep"),
      render: () => (
        <div className="space-y-4 text-sm">
          <dl className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <dt className="text-[var(--muted-foreground)]">{tCommon("name")}</dt>
            <dd>{name.trim()}</dd>
            <dt className="text-[var(--muted-foreground)]">{tCommon("descriptionLabel")}</dt>
            <dd>{description.trim() || tCommon("emDash")}</dd>
          </dl>
          <div className="space-y-1">
            <p className="text-[var(--muted-foreground)]">{t("templatesOrder")}</p>
            <ol className="list-decimal space-y-1 ps-5">
              {selectedTemplates.map((template) => (
                <li key={template.id}>{template.name}</li>
              ))}
            </ol>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
            />
            {t("autoAssignOnCreate")}
          </label>
        </div>
      ),
    },
  ];

  async function onSubmit() {
    setSaving(true);
    try {
      await ensureCsrf();
      const created = await api<{ data: ChecklistPack }>("/api/v1/org/checklists/packs", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          status: "published",
          auto_assign_on_create: autoAssign,
          template_ids: selectedTemplateIds,
        }),
      });
      toastSuccess(t("packCreated"));
      window.location.href = `/org/checklists/packs/${created.data.id}`;
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
      setSaving(false);
    }
  }

  return (
    <WizardDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("newPack")}
      steps={steps}
      onSubmit={onSubmit}
      labels={wizardLabels}
      busy={saving}
      isDirty={name !== "" || description !== "" || selectedTemplateIds.length > 0}
    />
  );
}
