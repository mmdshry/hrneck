"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import type {
  ChecklistPack,
  ChecklistTemplate,
} from "@/app/org/checklists/checklist-types";

type ConnectChecklistDialogProps = {
  targetId: number;
  templates: ChecklistTemplate[];
  packs: ChecklistPack[];
  onClose: () => void;
  onConnected: () => void | Promise<void>;
};

/** Connects one checklist template or pack to an employee. Mounted only while open. */
export function ConnectChecklistDialog({
  targetId,
  templates,
  packs,
  onClose,
  onConnected,
}: ConnectChecklistDialogProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const tChecklists = useTranslations("org.checklists");
  const [assignMode, setAssignMode] = useState<"template" | "pack">("template");
  const [templateId, setTemplateId] = useState<number | "">(templates[0]?.id ?? "");
  const [packId, setPackId] = useState<number | "">(packs[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

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
      onClose();
      await onConnected();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("assignFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("connectChecklist")}
      description={t("connectChecklistHint")}
      busy={saving}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form="connect-checklist-form" disabled={saving}>
            {saving ? tCommon("connecting") : t("connectToEmployee")}
          </Button>
        </>
      }
    >
      <form
        id="connect-checklist-form"
        onSubmit={(e) => void onAssign(e)}
        className="space-y-4"
      >
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
                  {pack.auto_assign_on_create ? ` (${tChecklists("autoOnHire")})` : ""}
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
              onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}
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
      </form>
    </Dialog>
  );
}
