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
  isReaderFormDirty,
  keepsStoredPassword,
  readerFormFor,
  readerRequestBody,
  type Reader,
  type ReaderForm,
  type ReaderMode,
} from "./email-reader-logic";

type EmailReaderWizardProps = {
  /** Reader to edit. Null starts the add flow. */
  reader: Reader | null;
  desks: SdDesk[];
  onClose: () => void;
  /** Called after a successful save, before the caller refreshes its list. */
  onSaved: (mode: ReaderMode) => void | Promise<void>;
};

/** Uses the inputs' native `required` constraints and reports the first invalid field. */
function fieldsAreValid(root: HTMLElement | null): boolean {
  if (!root) return false;
  return Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
  ).every((field) => field.reportValidity());
}

/**
 * Creates or edits one email reader in three steps. Mounted only while open, so every
 * session starts from fresh form state.
 */
export function EmailReaderWizard({ reader, desks, onClose, onSaved }: EmailReaderWizardProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const mode: ReaderMode = reader ? "update" : "create";
  const labels = useWizardLabels({ submit: reader ? tCommon("saveChanges") : t("saveReader") });
  const [initialForm] = useState<ReaderForm>(() => readerFormFor(reader, desks));
  const [form, setForm] = useState<ReaderForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const connectionRef = useRef<HTMLDivElement>(null);
  const routingRef = useRef<HTMLDivElement>(null);

  function patch<K extends keyof ReaderForm>(key: K, value: ReaderForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const deskName =
    desks.find((desk) => String(desk.id) === form.desk_id)?.name ?? tCommon("emDash");
  const reviewRows = [
    { label: tCommon("name"), value: form.name },
    { label: tCommon("desk"), value: deskName },
    { label: tCommon("host"), value: form.host },
    { label: tCommon("port"), value: form.port },
    { label: tCommon("username"), value: form.username },
    {
      label: tCommon("password"),
      value: keepsStoredPassword(form, mode)
        ? t("readerPasswordKept")
        : t("readerPasswordReplaced"),
    },
    ...(reader
      ? [
          {
            label: tCommon("status"),
            value: form.is_active ? tCommon("active") : tCommon("inactive"),
          },
        ]
      : []),
  ];

  const steps: WizardStep[] = [
    {
      id: "connection",
      title: t("readerStepConnection"),
      validate: () => fieldsAreValid(connectionRef.current),
      render: () => (
        <div ref={connectionRef} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="email-reader-name">{tCommon("name")}</Label>
            <Input
              id="email-reader-name"
              value={form.name}
              onChange={(e) => patch("name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-host">{tCommon("host")}</Label>
            <Input
              id="email-reader-host"
              value={form.host}
              onChange={(e) => patch("host", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-port">{tCommon("port")}</Label>
            <Input
              id="email-reader-port"
              value={form.port}
              onChange={(e) => patch("port", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-username">{tCommon("username")}</Label>
            <Input
              id="email-reader-username"
              value={form.username}
              onChange={(e) => patch("username", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email-reader-password">
              {reader ? t("passwordKeepHint") : t("password")}
            </Label>
            <Input
              id="email-reader-password"
              type="password"
              value={form.password}
              onChange={(e) => patch("password", e.target.value)}
              required={reader === null}
            />
          </div>
        </div>
      ),
    },
    {
      id: "desk",
      title: t("readerStepDesk"),
      validate: () => fieldsAreValid(routingRef.current),
      render: () => (
        <div ref={routingRef} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="email-reader-desk">{tCommon("desk")}</Label>
            <Select
              id="email-reader-desk"
              value={form.desk_id}
              onChange={(e) => patch("desk_id", e.target.value)}
              required
            >
              {desks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          {reader ? (
            <div className="space-y-1">
              <Label htmlFor="email-reader-active">{tCommon("active")}</Label>
              <Select
                id="email-reader-active"
                value={form.is_active ? "1" : "0"}
                onChange={(e) => patch("is_active", e.target.value === "1")}
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
      title: t("readerStepReview"),
      render: () => (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {reviewRows.map((row) => (
            <div key={row.label} className="min-w-0 space-y-0.5">
              <dt className="text-xs text-[var(--muted-foreground)]">{row.label}</dt>
              <dd className="break-words font-medium text-[var(--foreground)]">{row.value}</dd>
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
      if (reader) {
        await api(`/api/v1/org/ticketing/email-readers/${reader.id}`, {
          method: "PATCH",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(readerRequestBody(form, mode)),
        });
        toastSuccess(t("readerUpdated"));
      } else {
        await api("/api/v1/org/ticketing/email-readers", {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(readerRequestBody(form, mode)),
        });
        toastSuccess(t("readerCreated"));
      }
      onClose();
      await onSaved(mode);
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("saveFailed"));
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
      title={reader ? t("editReader") : t("addReader")}
      steps={steps}
      onSubmit={save}
      labels={labels}
      busy={saving}
      isDirty={isReaderFormDirty(form, initialForm)}
    />
  );
}
