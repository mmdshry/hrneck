"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { parseJsonArray, slaFormFromPolicy, type SlaForm } from "./desk-form-logic";
import type { DeskSla } from "./desk-types";

const FORM_ID = "desk-sla-form";

type SlaDialogProps = {
  deskId: number;
  /** Policy to edit. Null adds a policy. */
  policy: DeskSla | null;
  onClose: () => void;
  /** Runs after a successful save so the caller can reload the desk. */
  onSaved: () => void | Promise<void>;
};

export function SlaDialog({ deskId, policy, onClose, onSaved }: SlaDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [form, setForm] = useState<SlaForm>(() => slaFormFromPolicy(policy));
  const [saving, setSaving] = useState(false);

  function patch<K extends keyof SlaForm>(key: K, value: SlaForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      let goals: unknown[] | null;
      try {
        goals = parseJsonArray(form.goalsJson);
      } catch {
        goals = null;
      }
      if (!goals) throw new Error(t("goalsMustBeJsonArray"));
      await ensureCsrf();
      const payload = { name: form.name, goals, is_default: form.isDefault };
      const slaPath = `/api/v1/org/ticketing/desks/${deskId}/sla`;
      if (policy) {
        await api(`${slaPath}/${policy.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("slaPolicyUpdated"));
      } else {
        await api(slaPath, {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toastSuccess(t("slaPolicyAdded"));
      }
      onClose();
      await onSaved();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("slaSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={policy ? t("editSla") : t("addSla")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {policy ? t("updateSla") : t("addSla")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="grid gap-3" onSubmit={save}>
        <div className="space-y-1">
          <Label htmlFor="sla-name">{tCommon("name")}</Label>
          <Input
            id="sla-name"
            value={form.name}
            onChange={(e) => patch("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sla-goals">{t("goalsJson")}</Label>
          <Textarea
            id="sla-goals"
            rows={6}
            className="font-mono text-xs"
            value={form.goalsJson}
            onChange={(e) => patch("goalsJson", e.target.value)}
            required
          />
        </div>
        <label htmlFor="sla-default" className="flex items-center gap-2">
          <input
            id="sla-default"
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => patch("isDefault", e.target.checked)}
            className="h-4 w-4 rounded border border-[var(--border)]"
          />
          {t("defaultPolicy")}
        </label>
      </form>
    </Dialog>
  );
}
