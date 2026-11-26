export type ExportTarget = { id: number; name: string; email: string };
export type ExportGroup = { id: number; name: string };
export type UserReportMode = "single" | "list";
export type UserReportPeriodType = "monthly" | "quarterly";

export type UserReportForm = {
  periodKey: string;
  mode: UserReportMode;
  employeeSearch: string;
  selectedTarget: ExportTarget | null;
  groupId: string;
  includeTraining: boolean;
};

export function emptyUserReportForm(defaultPeriodKey: string): UserReportForm {
  return {
    periodKey: defaultPeriodKey,
    mode: "single",
    employeeSearch: "",
    selectedTarget: null,
    groupId: "",
    includeTraining: true,
  };
}

/** Quarterly period keys contain "-Q"; every other key is monthly. */
export function periodTypeFor(periodKey: string): UserReportPeriodType {
  return periodKey.includes("-Q") ? "quarterly" : "monthly";
}

export function employeeLabel(target: ExportTarget): string {
  return target.name === target.email ? target.email : `${target.name} (${target.email})`;
}

/**
 * Request body for a user report, or null when a single-employee report has no employee chosen.
 * Search text is UI-only and is not part of the body.
 */
export function userReportPayload(form: UserReportForm): Record<string, unknown> | null {
  const base = {
    scope: "user",
    period_type: periodTypeFor(form.periodKey),
    period_key: form.periodKey,
    include_training: form.includeTraining,
  };
  if (form.mode === "single") {
    if (form.selectedTarget === null) {
      return null;
    }
    return { ...base, mode: "single", target_id: form.selectedTarget.id };
  }
  return {
    ...base,
    mode: "list",
    group_id: form.groupId ? Number(form.groupId) : undefined,
  };
}

/** Every field is a primitive or the selected target object, which is replaced rather than mutated. */
export function isUserReportFormDirty(form: UserReportForm, initial: UserReportForm): boolean {
  return (Object.keys(form) as Array<keyof UserReportForm>).some(
    (key) => form[key] !== initial[key],
  );
}
