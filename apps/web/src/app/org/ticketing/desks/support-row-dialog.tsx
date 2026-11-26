"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { buildSupportPayload, EMPTY_SUPPORT_FORM, type SupportForm } from "./desk-form-logic";
import type { SupportTable } from "./desk-types";

const FORM_ID = "desk-support-form";

type SupportRowDialogProps = {
  deskId: number;
  /** Table preselected from the section the user opened the dialog from. */
  initialTable: SupportTable;
  onClose: () => void;
  /** Runs after a successful save so the caller can reload the desk. */
  onSaved: () => void | Promise<void>;
};

export function SupportRowDialog({ deskId, initialTable, onClose, onSaved }: SupportRowDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [table, setTable] = useState<SupportTable>(initialTable);
  const [form, setForm] = useState<SupportForm>(EMPTY_SUPPORT_FORM);
  const [saving, setSaving] = useState(false);
  const rowAddedMessages: Record<SupportTable, string> = {
    statuses: t("supportRowAddedStatuses"),
    priorities: t("supportRowAddedPriorities"),
    severities: t("supportRowAddedSeverities"),
    categories: t("supportRowAddedCategories"),
  };

  function patch<K extends keyof SupportForm>(key: K, value: SupportForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/ticketing/desks/${deskId}/support/${table}`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSupportPayload(table, form)),
      });
      toastSuccess(rowAddedMessages[table]);
      onClose();
      await onSaved();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("addSupportRowFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={t("addSupportRow")}
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {t("addSupportRow")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="support-table">{t("supportTable")}</Label>
          <Select
            id="support-table"
            value={table}
            onChange={(e) => setTable(e.target.value as SupportTable)}
          >
            <option value="statuses">{t("statuses")}</option>
            <option value="priorities">{t("priorities")}</option>
            <option value="severities">{t("severities")}</option>
            <option value="categories">{t("categories")}</option>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="support-name">{tCommon("name")}</Label>
          <Input
            id="support-name"
            value={form.name}
            onChange={(e) => patch("name", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="support-slug">{tCommon("slug")}</Label>
          <Input
            id="support-slug"
            value={form.slug}
            onChange={(e) => patch("slug", e.target.value)}
            placeholder={tCommon("optionalPlaceholder")}
          />
        </div>
        {table === "statuses" ? (
          <label htmlFor="support-closed" className="flex items-center gap-2 sm:col-span-2">
            <input
              id="support-closed"
              type="checkbox"
              checked={form.closed}
              onChange={(e) => patch("closed", e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--border)]"
            />
            {t("closedStatus")}
          </label>
        ) : null}
        {table === "priorities" ? (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="support-weight">{tCommon("weight")}</Label>
            <Input
              id="support-weight"
              inputMode="numeric"
              value={form.weight}
              onChange={(e) => patch("weight", e.target.value)}
            />
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
