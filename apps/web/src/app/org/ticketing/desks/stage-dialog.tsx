"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { buildStagePayload, stageFormFromStage, type StageForm } from "./desk-form-logic";
import type { DeskStage } from "./desk-types";

const FORM_ID = "desk-stage-form";

type StageDialogProps = {
  deskId: number;
  /** Stage to edit. Null adds a stage. */
  stage: DeskStage | null;
  onClose: () => void;
  /** Runs after a successful save so the caller can reload the desk. */
  onSaved: () => void | Promise<void>;
};

export function StageDialog({ deskId, stage, onClose, onSaved }: StageDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [form, setForm] = useState<StageForm>(() => stageFormFromStage(stage));
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof StageForm>(key: K, value: StageForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      const payload = buildStagePayload(form);
      const stagesPath = `/api/v1/org/ticketing/desks/${deskId}/stages`;
      if (stage) {
        await api(`${stagesPath}/${stage.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("stageUpdated"));
      } else {
        await api(stagesPath, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("stageAdded"));
      }
      onClose();
      await onSaved();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("stageSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={stage ? t("editStage") : t("addStage")}
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {stage ? t("updateStage") : t("addStage")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="stage-name">{t("stageName")}</Label>
          <Input
            id="stage-name"
            value={form.name}
            onChange={(e) => patch("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="stage-sequence">{tCommon("sequence")}</Label>
          <Input
            id="stage-sequence"
            inputMode="numeric"
            value={form.sequence}
            onChange={(e) => patch("sequence", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="stage-escalation">{t("escalationMinutes")}</Label>
          <Input
            id="stage-escalation"
            inputMode="numeric"
            value={form.escalation}
            onChange={(e) => patch("escalation", e.target.value)}
            placeholder={tCommon("optionalPlaceholder")}
          />
        </div>
        <label htmlFor="stage-terminal" className="flex items-center gap-2 sm:col-span-2">
          <input
            id="stage-terminal"
            type="checkbox"
            checked={form.terminal}
            onChange={(e) => patch("terminal", e.target.checked)}
            className="h-4 w-4 rounded border border-[var(--border)]"
          />
          {tCommon("terminal")}
        </label>
      </form>
    </Dialog>
  );
}
