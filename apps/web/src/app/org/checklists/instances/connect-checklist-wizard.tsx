"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AudiencePicker,
  type AudienceGroup,
  type AudienceTarget,
} from "@/app/org/training/audience-picker";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import type { ChecklistPack, ChecklistTemplate } from "../checklist-types";

type AssignMode = "template" | "pack";

type ConnectChecklistWizardProps = {
  templates: ChecklistTemplate[];
  packs: ChecklistPack[];
  targets: AudienceTarget[];
  groups: AudienceGroup[];
  onConnected: () => Promise<void>;
  onClose: () => void;
};

export function ConnectChecklistWizard({
  templates,
  packs,
  targets,
  groups,
  onConnected,
  onClose,
}: ConnectChecklistWizardProps) {
  const t = useTranslations("org.checklists");
  const tCommon = useTranslations("common");
  const wizardLabels = useWizardLabels({ submit: t("connect") });
  const sourceFormRef = useRef<HTMLFormElement>(null);
  const [assignMode, setAssignMode] = useState<AssignMode>("template");
  const [templateId, setTemplateId] = useState<number | "">(templates[0]?.id ?? "");
  const [packId, setPackId] = useState<number | "">(packs[0]?.id ?? "");
  const [selectedTargetIds, setSelectedTargetIds] = useState<number[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  const sourceName =
    assignMode === "pack"
      ? packs.find((pack) => pack.id === packId)?.name
      : templates.find((template) => template.id === templateId)?.name;

  const steps: WizardStep[] = [
    {
      id: "source",
      title: tCommon("source"),
      validate: () => sourceFormRef.current?.reportValidity() ?? false,
      render: () => (
        <form ref={sourceFormRef} className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-1.5">
            <Label htmlFor="instance-assign-mode">{t("assign")}</Label>
            <Select
              id="instance-assign-mode"
              value={assignMode}
              onChange={(e) => setAssignMode(e.target.value as AssignMode)}
            >
              <option value="template">{t("singleTemplate")}</option>
              <option value="pack">{t("checklistPack")}</option>
            </Select>
          </div>
          {assignMode === "pack" ? (
            <div className="space-y-1.5">
              <Label htmlFor="instance-pack">{tCommon("pack")}</Label>
              <Select
                id="instance-pack"
                value={packId === "" ? "" : String(packId)}
                onChange={(e) => setPackId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">{t("selectPack")}</option>
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="instance-template">{tCommon("template")}</Label>
              <Select
                id="instance-template"
                value={templateId === "" ? "" : String(templateId)}
                onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">{t("selectTemplate")}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </form>
      ),
    },
    {
      id: "audience",
      title: t("audienceStep"),
      render: () => (
        <AudiencePicker
          targets={targets}
          groups={groups}
          selectedTargetIds={selectedTargetIds}
          selectedGroupIds={selectedGroupIds}
          onChangeTargets={setSelectedTargetIds}
          onChangeGroups={setSelectedGroupIds}
        />
      ),
    },
    {
      id: "review",
      title: t("reviewStep"),
      render: () => (
        <div className="space-y-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <dt className="text-[var(--muted-foreground)]">{t("assign")}</dt>
            <dd>{assignMode === "pack" ? t("checklistPack") : t("singleTemplate")}</dd>
            <dt className="text-[var(--muted-foreground)]">{tCommon("name")}</dt>
            <dd>{sourceName ?? tCommon("emDash")}</dd>
          </dl>
          <ul className="list-disc space-y-1 ps-5">
            <li>{t("employeesSelected", { count: selectedTargetIds.length })}</li>
            <li>{t("groupsSelected", { count: selectedGroupIds.length })}</li>
          </ul>
        </div>
      ),
    },
  ];

  async function onSubmit() {
    try {
      await ensureCsrf();
      if (assignMode === "pack") {
        await api(`/api/v1/org/checklists/packs/${packId}/assign`, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_ids: selectedTargetIds,
            group_ids: selectedGroupIds,
          }),
        });
        toastSuccess(t("packConnected"));
      } else {
        await api("/api/v1/org/checklists/instances", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            target_ids: selectedTargetIds,
            group_ids: selectedGroupIds,
          }),
        });
        toastSuccess(t("checklistsConnected"));
      }
      onClose();
      await onConnected();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("assignFailed"));
    }
  }

  return (
    <WizardDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("connectChecklist")}
      steps={steps}
      onSubmit={onSubmit}
      labels={wizardLabels}
      size="xl"
      isDirty={selectedTargetIds.length > 0 || selectedGroupIds.length > 0}
    />
  );
}
