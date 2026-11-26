"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { RecipientPicker } from "./recipient-picker";
import {
  cadenceLabel,
  recipientName,
  sectionLabel,
  sectionOptions,
  selectedRecipientLabels,
  type ReportRecipient,
  type ReportSchedule,
  type ScheduleSection,
} from "./report-schedule-form";
import { ReportScheduleWizard } from "./report-schedule-wizard";

export function ReportSchedulesPanel() {
  const t = useTranslations("org.reports");
  const tCommon = useTranslations("common");
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [recipientOptions, setRecipientOptions] = useState<ReportRecipient[]>([]);
  const [oneOffRecipientIds, setOneOffRecipientIds] = useState<number[]>([]);
  const [oneOffSection, setOneOffSection] = useState<ScheduleSection>("campaigns");
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ReportSchedule | null>(null);
  const [sendNowOpen, setSendNowOpen] = useState(false);
  const [scheduleWizard, setScheduleWizard] = useState<{
    schedule: ReportSchedule | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: ReportSchedule[] }>("/api/v1/org/reports/schedules", {
      tenant: resolveTenant(),
    });
    setSchedules(Array.isArray(res.data) ? res.data : []);
  }, []);

  const loadRecipients = useCallback(async () => {
    await ensureCsrf();
    const res = await api<{ data: ReportRecipient[] }>("/api/v1/org/reports/recipients", {
      tenant: resolveTenant(),
    });
    setRecipientOptions(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        toastError(err instanceof Error ? err.message : t("failedSchedules"));
      })
      .finally(() => setLoading(false));
  }, [refresh, t]);

  useEffect(() => {
    void loadRecipients().catch((err: unknown) => {
      toastError(err instanceof Error ? err.message : t("recipientsLoadFailed"));
    });
  }, [loadRecipients, t]);

  async function onDelete() {
    if (!pendingDelete) return;
    try {
      await ensureCsrf();
      await api(`/api/v1/org/reports/schedules/${pendingDelete.id}`, {
        method: "DELETE",
        tenant: resolveTenant(),
      });
      setPendingDelete(null);
      await refresh();
      toastSuccess(t("scheduleDeleted"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("deleteFailed"));
    }
  }

  function onSendNowSubmit(event: FormEvent) {
    event.preventDefault();
    setSendNowOpen(true);
  }

  async function onSendNow() {
    try {
      await ensureCsrf();
      await api("/api/v1/org/reports/email", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_user_ids: oneOffRecipientIds, section: oneOffSection }),
      });
      toastSuccess(t("reportEmailQueued"));
      setOneOffRecipientIds([]);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("sendFailed"));
      throw err;
    }
  }

  return (
    <Panel className="mt-8 space-y-6 p-4">
      <div>
        <h2 className="text-lg font-medium">{t("scheduledEmailReports")}</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{t("scheduleDescription")}</p>
      </div>

      <form onSubmit={onSendNowSubmit} className="flex flex-wrap items-start gap-2">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor="one-off-recipients">{t("sendReportNow")}</Label>
          <RecipientPicker
            id="one-off-recipients"
            options={recipientOptions}
            selectedIds={oneOffRecipientIds}
            onChange={setOneOffRecipientIds}
          />
        </div>
        <div className="min-w-[12rem] space-y-1">
          <Label htmlFor="one-off-section">{t("reportSection")}</Label>
          <Select
            id="one-off-section"
            value={oneOffSection}
            onChange={(e) => setOneOffSection(e.target.value as ScheduleSection)}
          >
            {sectionOptions(t, tCommon).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary" disabled={oneOffRecipientIds.length === 0}>
          {t("queueEmail")}
        </Button>
      </form>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("existingSchedules")}</h3>
          <Button type="button" onClick={() => setScheduleWizard({ schedule: null })}>
            {t("addSchedule")}
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">{t("loadingSchedules")}</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">{t("noSchedulesYet")}</p>
        ) : (
          <ul className="space-y-3">
            {schedules.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2"
              >
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {cadenceLabel(row.cadence, tCommon)} · {row.format.toUpperCase()}
                    {row.format === "csv" ? ` · ${sectionLabel(row.section, t, tCommon)}` : ""} ·{" "}
                    {row.recipients.length === 0
                      ? t("noRecipientsSet")
                      : row.recipients
                          .map((recipient) =>
                            recipient.eligible
                              ? recipientName(recipient)
                              : `${recipientName(recipient)} (${t("recipientUnavailable")})`,
                          )
                          .join(", ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setScheduleWizard({ schedule: row })}
                  >
                    {tCommon("edit")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingDelete(row)}
                  >
                    {tCommon("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {scheduleWizard ? (
        <ReportScheduleWizard
          schedule={scheduleWizard.schedule}
          recipientOptions={recipientOptions}
          onClose={() => setScheduleWizard(null)}
          onSaved={refresh}
        />
      ) : null}

      <ConfirmDialog
        open={sendNowOpen}
        onOpenChange={setSendNowOpen}
        title={t("sendReportNow")}
        description={t("sendNowConfirm", {
          section: sectionLabel(oneOffSection, t, tCommon),
          recipients: selectedRecipientLabels(oneOffRecipientIds, recipientOptions).join(", "),
        })}
        confirmLabel={t("queueEmail")}
        cancelLabel={tCommon("cancel")}
        closeLabel={tCommon("close")}
        workingLabel={tCommon("working")}
        errorFallback={t("sendFailed")}
        onConfirm={onSendNow}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("deleteSchedule")}
        description={
          pendingDelete
            ? t("removeScheduleConfirm", {
                name: pendingDelete.name,
                email: pendingDelete.recipients.map(recipientName).join(", "),
              })
            : ""
        }
        confirmLabel={tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        closeLabel={tCommon("close")}
        workingLabel={tCommon("working")}
        errorFallback={tCommon("deleteFailed")}
        variant="destructive"
        onConfirm={onDelete}
      />
    </Panel>
  );
}
