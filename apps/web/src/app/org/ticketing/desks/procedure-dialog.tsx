"use client";

import { useState, type FormEvent } from "react";
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
import { parseJsonArray, procedureFormFromProcedure, type ProcedureForm } from "./desk-form-logic";
import type { DeskProcedure } from "./desk-types";

const FORM_ID = "desk-procedure-form";

type ProcedureDialogProps = {
  deskId: number;
  /** Procedure to edit. Null adds a procedure. */
  procedure: DeskProcedure | null;
  /** Stages of the desk, offered as the optional stage trigger. */
  stages: Array<{ id: number; name: string }>;
  onClose: () => void;
  /** Runs after a successful save so the caller can reload the desk. */
  onSaved: () => void | Promise<void>;
};

export function ProcedureDialog({
  deskId,
  procedure,
  stages,
  onClose,
  onSaved,
}: ProcedureDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [form, setForm] = useState<ProcedureForm>(() => procedureFormFromProcedure(procedure));
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof ProcedureForm>(key: K, value: ProcedureForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      let steps: unknown[] | null;
      try {
        steps = parseJsonArray(form.stepsJson);
      } catch {
        steps = null;
      }
      if (!steps) throw new Error(t("stepsMustBeJsonArray"));
      await ensureCsrf();
      const payload = {
        name: form.name,
        hook: form.hook,
        stage_id: form.stageId ? Number(form.stageId) : null,
        is_active: form.active,
        steps,
      };
      const proceduresPath = `/api/v1/org/ticketing/desks/${deskId}/procedures`;
      if (procedure) {
        await api(`${proceduresPath}/${procedure.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("procedureUpdated"));
      } else {
        await api(proceduresPath, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("procedureAdded"));
      }
      onClose();
      await onSaved();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("procedureSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={procedure ? t("editProcedure") : t("addProcedure")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {procedure ? t("updateProcedure") : t("addProcedure")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="procedure-name">{tCommon("name")}</Label>
          <Input
            id="procedure-name"
            value={form.name}
            onChange={(e) => patch("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="procedure-hook">{t("hook")}</Label>
          <Select
            id="procedure-hook"
            value={form.hook}
            onChange={(e) => patch("hook", e.target.value)}
          >
            <option value="on_create">{t("onCreate")}</option>
            <option value="on_stage_enter">{t("onStageEnter")}</option>
            <option value="on_escalation">{t("onEscalation")}</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="procedure-stage">{t("stageOptional")}</Label>
          <Select
            id="procedure-stage"
            value={form.stageId}
            onChange={(e) => patch("stageId", e.target.value)}
          >
            <option value="">{tCommon("none")}</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="procedure-steps">{t("stepsJson")}</Label>
          <Textarea
            id="procedure-steps"
            rows={6}
            className="font-mono text-xs"
            value={form.stepsJson}
            onChange={(e) => patch("stepsJson", e.target.value)}
            required
          />
        </div>
        <label htmlFor="procedure-active" className="flex items-center gap-2 sm:col-span-2">
          <input
            id="procedure-active"
            type="checkbox"
            checked={form.active}
            onChange={(e) => patch("active", e.target.checked)}
            className="h-4 w-4 rounded border border-[var(--border)]"
          />
          {tCommon("active")}
        </label>
      </form>
    </Dialog>
  );
}
