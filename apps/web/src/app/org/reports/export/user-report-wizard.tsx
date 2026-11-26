"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import {
  emptyUserReportForm,
  employeeLabel,
  isUserReportFormDirty,
  userReportPayload,
  type ExportGroup,
  type ExportTarget,
  type UserReportForm,
  type UserReportMode,
} from "./user-report-form";

type ExportOptionsPayload = {
  targets: ExportTarget[];
  groups: ExportGroup[];
};

type UserReportWizardProps = {
  /** Period pre-selected from the export calendar. */
  defaultPeriodKey: string;
  onClose: () => void;
  /** Posts the report and refreshes the log. Resolves true when the report was generated. */
  onGenerate: (payload: Record<string, unknown>, label: string) => Promise<boolean>;
};

/**
 * Builds one employee or group PDF in four steps. Mounted only while open, so every
 * session starts from fresh form state.
 */
export function UserReportWizard({
  defaultPeriodKey,
  onClose,
  onGenerate,
}: UserReportWizardProps) {
  const t = useTranslations("org.export");
  const tCommon = useTranslations("common");
  const labels = useWizardLabels({ submit: t("generatePdf") });
  const [initialForm] = useState<UserReportForm>(() => emptyUserReportForm(defaultPeriodKey));
  const [form, setForm] = useState<UserReportForm>(initialForm);
  const [targetOptions, setTargetOptions] = useState<ExportTarget[]>([]);
  const [groupOptions, setGroupOptions] = useState<ExportGroup[]>([]);
  const [generating, setGenerating] = useState(false);
  const periodRef = useRef<HTMLInputElement>(null);

  const selectedTarget = form.selectedTarget;
  const employeeSearch = form.employeeSearch;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await ensureCsrf();
          const search = employeeSearch.trim();
          const res = await api<{ data: ExportOptionsPayload }>(
            `/api/v1/org/reports/export/options${search ? `?q=${encodeURIComponent(search)}` : ""}`,
            { tenant: resolveTenant() },
          );
          setTargetOptions(res.data.targets ?? []);
          setGroupOptions(res.data.groups ?? []);
        } catch (err) {
          toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [employeeSearch, tCommon]);

  /** Keeps the chosen employee selectable even when the current search no longer returns them. */
  const visibleTargetOptions =
    selectedTarget && !targetOptions.some((item) => item.id === selectedTarget.id)
      ? [selectedTarget, ...targetOptions]
      : targetOptions;
  const isDirty = isUserReportFormDirty(form, initialForm);

  function patch(next: Partial<UserReportForm>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function validatePeriod(): boolean {
    return periodRef.current?.reportValidity() ?? false;
  }

  function validateScope(): boolean {
    if (userReportPayload(form) !== null) {
      return true;
    }
    toastError(t("selectEmployeeFirst"));
    return false;
  }

  function scopeSummary(): string {
    if (form.mode === "single") {
      return selectedTarget ? employeeLabel(selectedTarget) : "";
    }
    const group = groupOptions.find((item) => String(item.id) === form.groupId);
    return group?.name ?? t("allGroupsWithActivity");
  }

  async function generate() {
    const payload = userReportPayload(form);
    if (payload === null) {
      toastError(t("selectEmployeeFirst"));
      return;
    }
    setGenerating(true);
    try {
      const generated = await onGenerate(payload, form.periodKey);
      if (generated) {
        onClose();
      }
    } finally {
      setGenerating(false);
    }
  }

  const steps: WizardStep[] = [
    {
      id: "period",
      title: tCommon("period"),
      validate: validatePeriod,
      render: () => (
        <div className="space-y-1">
          <Label htmlFor="export-period-key" className="text-[var(--muted-foreground)]">
            {t("periodKey")}
          </Label>
          <Input
            id="export-period-key"
            ref={periodRef}
            value={form.periodKey}
            onChange={(e) => patch({ periodKey: e.target.value })}
            placeholder="2026-Q3"
            required
          />
        </div>
      ),
    },
    {
      id: "scope",
      title: tCommon("scope"),
      validate: validateScope,
      render: () => (
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="export-employee-mode" className="text-[var(--muted-foreground)]">
              {t("employeeReportMode")}
            </Label>
            <Select
              id="export-employee-mode"
              value={form.mode}
              onChange={(e) => patch({ mode: e.target.value as UserReportMode })}
            >
              <option value="single">{t("singleEmployee")}</option>
              <option value="list">{t("employeeList")}</option>
            </Select>
          </div>
          {form.mode === "single" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="export-employee-search" className="text-[var(--muted-foreground)]">
                  {t("searchEmployees")}
                </Label>
                <Input
                  id="export-employee-search"
                  value={form.employeeSearch}
                  onChange={(e) => patch({ employeeSearch: e.target.value })}
                  placeholder={t("searchEmployees")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="export-employee-target" className="text-[var(--muted-foreground)]">
                  {t("employeeTarget")}
                </Label>
                <Select
                  id="export-employee-target"
                  value={selectedTarget ? String(selectedTarget.id) : ""}
                  onChange={(e) => {
                    const next = visibleTargetOptions.find(
                      (item) => String(item.id) === e.target.value,
                    );
                    patch({ selectedTarget: next ?? null });
                  }}
                >
                  <option value="">{t("chooseEmployee")}</option>
                  {visibleTargetOptions.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {employeeLabel(item)}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="export-employee-group" className="text-[var(--muted-foreground)]">
                {tCommon("group")}
              </Label>
              <Select
                id="export-employee-group"
                value={form.groupId}
                onChange={(e) => patch({ groupId: e.target.value })}
              >
                <option value="">{t("allGroupsWithActivity")}</option>
                {groupOptions.map((group) => (
                  <option key={group.id} value={String(group.id)}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      ),
    },
    {
      id: "options",
      title: tCommon("options"),
      render: () => (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.includeTraining}
            onChange={(e) => patch({ includeTraining: e.target.checked })}
            className="h-4 w-4 rounded border border-[var(--border)]"
          />
          {t("includeTraining")}
        </label>
      ),
    },
    {
      id: "review",
      title: t("stepReview"),
      render: () => (
        <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-[var(--muted-foreground)]">{t("periodKey")}</dt>
          <dd className="font-medium">{form.periodKey}</dd>
          <dt className="text-[var(--muted-foreground)]">{t("employeeReportMode")}</dt>
          <dd>{form.mode === "single" ? t("singleEmployee") : t("employeeList")}</dd>
          <dt className="text-[var(--muted-foreground)]">
            {form.mode === "single" ? t("employeeTarget") : tCommon("group")}
          </dt>
          <dd className="break-words">{scopeSummary()}</dd>
          <dt className="text-[var(--muted-foreground)]">{t("includeTraining")}</dt>
          <dd>{form.includeTraining ? tCommon("yes") : tCommon("no")}</dd>
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
      title={t("newUserReport")}
      steps={steps}
      onSubmit={generate}
      labels={labels}
      busy={generating}
      isDirty={isDirty}
    />
  );
}
