"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { RecipientPicker } from "./recipient-picker";
import {
  cadenceLabel,
  emptyScheduleForm,
  hasUnavailableRecipients,
  isScheduleFormDirty,
  nextCadenceForFormat,
  recipientPickerOptions,
  scheduleFormFromSchedule,
  scheduleRequestBody,
  sectionLabel,
  sectionOptions,
  selectedRecipientLabels,
  type Cadence,
  type ReportRecipient,
  type ReportSchedule,
  type ScheduleForm,
  type ScheduleFormat,
  type ScheduleSection,
} from "./report-schedule-form";

type ReportScheduleWizardProps = {
  /** Schedule to edit. Null starts the create flow. */
  schedule: ReportSchedule | null;
  /** Members who currently have report access. */
  recipientOptions: ReportRecipient[];
  onClose: () => void;
  /** Reloads the schedule list after a successful save. */
  onSaved: () => Promise<void>;
};

/**
 * Creates or edits a scheduled report email in three steps. Mounted only while open,
 * so every session starts from fresh form state.
 */
export function ReportScheduleWizard({
  schedule,
  recipientOptions,
  onClose,
  onSaved,
}: ReportScheduleWizardProps) {
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const labels = useWizardLabels({
    submit: schedule ? tCommon("saveChanges") : t("addSchedule"),
  });
  const [initialForm] = useState<ScheduleForm>(() =>
    schedule ? scheduleFormFromSchedule(schedule) : emptyScheduleForm(t("monthlyCsv")),
  );
  const [form, setForm] = useState<ScheduleForm>(initialForm);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const pickerOptions = recipientPickerOptions(recipientOptions, schedule);
  const blockedByAccess = hasUnavailableRecipients(form.recipientIds, recipientOptions);
  const recipientMessage = blockedByAccess ? t("recipientsSaveBlocked") : recipientError;
  const isDirty = isScheduleFormDirty(form, initialForm);

  function patch(next: Partial<ScheduleForm>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function validateSchedule(): boolean {
    return nameRef.current?.reportValidity() ?? false;
  }

  function validateRecipients(): boolean {
    if (form.recipientIds.length === 0) {
      setRecipientError(t("recipientsRequired"));
      return false;
    }
    return !blockedByAccess;
  }

  async function save() {
    setSaving(true);
    try {
      await ensureCsrf();
      const request = {
        headers: { "Content-Type": "application/json" },
        tenant: resolveTenant(),
        body: JSON.stringify(scheduleRequestBody(form)),
      };
      if (schedule) {
        await api(`/api/v1/org/reports/schedules/${schedule.id}`, { ...request, method: "PATCH" });
      } else {
        await api("/api/v1/org/reports/schedules", { ...request, method: "POST" });
      }
      await onSaved();
      toastSuccess(schedule ? t("scheduleUpdated") : t("scheduleCreated"));
      onClose();
    } catch (err) {
      const fallback = schedule ? tCommon("updateFailed") : tCommon("createFailed");
      toastError(err instanceof Error ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  const steps: WizardStep[] = [
    {
      id: "schedule",
      title: t("stepSchedule"),
      validate: validateSchedule,
      render: () => (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="schedule-name">{tCommon("name")}</Label>
            <Input
              id="schedule-name"
              ref={nameRef}
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="schedule-cadence">{t("cadence")}</Label>
            <Select
              id="schedule-cadence"
              value={form.cadence}
              onChange={(e) => patch({ cadence: e.target.value as Cadence })}
            >
              <option value="weekly" disabled={form.format === "pdf"}>
                {tCommon("weekly")}
              </option>
              <option value="monthly">{tCommon("monthly")}</option>
              <option value="quarterly">{tCommon("quarterly")}</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="schedule-format">{tCommon("format")}</Label>
            <Select
              id="schedule-format"
              value={form.format}
              onChange={(e) => {
                const next = e.target.value as ScheduleFormat;
                patch({ format: next, cadence: nextCadenceForFormat(next, form.cadence) });
              }}
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </Select>
          </div>
        </div>
      ),
    },
    {
      id: "recipients",
      title: t("stepRecipients"),
      validate: validateRecipients,
      render: () => (
        <div className="grid gap-4">
          {form.format === "csv" ? (
            <div className="space-y-1">
              <Label htmlFor="schedule-section">{t("reportSection")}</Label>
              <Select
                id="schedule-section"
                value={form.section}
                onChange={(e) => patch({ section: e.target.value as ScheduleSection })}
              >
                {sectionOptions(t, tCommon).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">{t("pdfScheduleHint")}</p>
          )}
          <div className="space-y-1">
            <Label htmlFor="schedule-recipients">{tCommon("recipients")}</Label>
            <RecipientPicker
              id="schedule-recipients"
              options={pickerOptions}
              selectedIds={form.recipientIds}
              onChange={(ids) => {
                setRecipientError(null);
                patch({ recipientIds: ids });
              }}
            />
          </div>
          {recipientMessage ? (
            <p role="alert" className="text-sm text-[var(--destructive)]">
              {recipientMessage}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "review",
      title: t("stepReview"),
      render: () => (
        <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-[var(--muted-foreground)]">{tCommon("name")}</dt>
          <dd className="font-medium break-words">{form.name}</dd>
          <dt className="text-[var(--muted-foreground)]">{t("cadence")}</dt>
          <dd>{cadenceLabel(form.cadence, tCommon)}</dd>
          <dt className="text-[var(--muted-foreground)]">{tCommon("format")}</dt>
          <dd>{form.format.toUpperCase()}</dd>
          {form.format === "csv" ? (
            <>
              <dt className="text-[var(--muted-foreground)]">{t("reportSection")}</dt>
              <dd>{sectionLabel(form.section, t, tCommon)}</dd>
            </>
          ) : null}
          <dt className="text-[var(--muted-foreground)]">{tCommon("recipients")}</dt>
          <dd className="break-words">
            {selectedRecipientLabels(form.recipientIds, pickerOptions).join(", ")}
          </dd>
        </dl>
      ),
    },
  ];

  return (
    <WizardDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={schedule ? t("editSchedule") : t("addSchedule")}
      steps={steps}
      onSubmit={save}
      labels={labels}
      busy={saving}
      isDirty={isDirty}
    />
  );
}
