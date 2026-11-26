"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import type { SdDesk } from "../ticketing-types";
import {
  createDeskBody,
  deskFormFromDesk,
  emptyDeskForm,
  isDeskFormDirty,
  updateDeskBody,
  type DeskForm,
} from "./desk-form-logic";
import { DESK_TYPES, isDeskType, type DeskType } from "./desk-types";

type DeskWizardProps = {
  /** Desk to edit. Null starts the create flow. */
  desk: SdDesk | null;
  onClose: () => void;
  /** Called after a successful save. `created` is true when a new desk was made. */
  onSaved: (saved: SdDesk, created: boolean) => void | Promise<void>;
};

/**
 * Creates or edits a desk in three steps. Mounted only while open, so every
 * session starts from fresh form state.
 */
export function DeskWizard({ desk, onClose, onSaved }: DeskWizardProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const labels = useWizardLabels({ submit: desk ? t("saveDesk") : t("createDesk") });
  const [initialForm] = useState<DeskForm>(() => (desk ? deskFormFromDesk(desk) : emptyDeskForm()));
  const [form, setForm] = useState<DeskForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const typeLabels: Record<DeskType, string> = {
    incident: tCommon("incident"),
    problem: tCommon("problem"),
    service_request: tCommon("serviceRequest"),
    change: tCommon("change"),
    kb: tCommon("knowledgeBase"),
  };
  const typeLabel = isDeskType(form.type) ? typeLabels[form.type] : form.type;

  function patch<K extends keyof DeskForm>(key: K, value: DeskForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const reviewRows = [
    { label: tCommon("name"), value: form.name },
    { label: tCommon("type"), value: typeLabel },
    { label: t("numberPrefix"), value: form.prefix || tCommon("emDash") },
    { label: tCommon("active"), value: form.active ? tCommon("yes") : tCommon("no") },
  ];

  const steps: WizardStep[] = [
    {
      id: "basics",
      title: t("deskStepBasics"),
      description: t("deskBasicsHint"),
      validate: () => nameRef.current?.reportValidity() ?? false,
      render: () => (
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="desk-name">{tCommon("name")}</Label>
            <Input
              id="desk-name"
              ref={nameRef}
              value={form.name}
              onChange={(e) => patch("name", e.target.value)}
              required
            />
          </div>
          {desk ? null : (
            <div className="space-y-1">
              <Label htmlFor="desk-type">{tCommon("type")}</Label>
              <Select
                id="desk-type"
                value={form.type}
                onChange={(e) => patch("type", e.target.value)}
              >
                {DESK_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {typeLabels[value]}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "numbering",
      title: t("deskStepNumbering"),
      description: t("deskNumberingHint"),
      render: () => (
        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="desk-prefix">{t("numberPrefix")}</Label>
            <Input
              id="desk-prefix"
              value={form.prefix}
              onChange={(e) => patch("prefix", e.target.value)}
              placeholder={tCommon("optionalPlaceholder")}
            />
          </div>
          {desk ? (
            <div className="space-y-1">
              <Label htmlFor="desk-active">{tCommon("active")}</Label>
              <Select
                id="desk-active"
                value={form.active ? "1" : "0"}
                onChange={(e) => patch("active", e.target.value === "1")}
              >
                <option value="1">{tCommon("active")}</option>
                <option value="0">{tCommon("inactive")}</option>
              </Select>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "review",
      title: t("deskStepReview"),
      description: t("deskReviewHint"),
      render: () => (
        <dl className="grid gap-3 sm:grid-cols-2">
          {reviewRows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-xs text-[var(--muted-foreground)]">{row.label}</dt>
              <dd className="break-words text-sm font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  ];

  async function save() {
    setSaving(true);
    try {
      await ensureCsrf();
      if (desk) {
        await api(`/api/v1/org/ticketing/desks/${desk.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateDeskBody(form)),
        });
        toastSuccess(t("deskUpdated"));
        onClose();
        await onSaved(desk, false);
      } else {
        const created = await api<{ data: SdDesk }>("/api/v1/org/ticketing/desks", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createDeskBody(form)),
        });
        toastSuccess(t("deskCreated", { name: created.data.name }));
        onClose();
        await onSaved(created.data, true);
      }
    } catch (err) {
      const fallback = desk ? t("updateDeskFailed") : t("createDeskFailed");
      toastError(err instanceof Error ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={desk ? t("editDesk") : t("createDesk")}
      steps={steps}
      onSubmit={save}
      labels={labels}
      busy={saving}
      isDirty={isDeskFormDirty(form, initialForm)}
    />
  );
}
