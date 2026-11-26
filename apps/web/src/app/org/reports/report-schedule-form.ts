import type { RecipientOption } from "./recipient-picker";

export type Cadence = "monthly" | "weekly" | "quarterly";
export type ScheduleFormat = "csv" | "pdf";
export type ScheduleSection =
  | "campaigns"
  | "training"
  | "checklists"
  | "ticketing"
  | "recipients"
  | "users"
  | "targets"
  | "company"
  | "summary";

export type ScheduleRecipient = {
  id: number;
  name: string | null;
  email: string | null;
  /** False when the person was removed from the organization or lost report access. */
  eligible: boolean;
};

export type ReportSchedule = {
  id: number;
  name: string;
  cadence: Cadence;
  format: ScheduleFormat;
  section: ScheduleSection;
  recipients: ScheduleRecipient[];
  next_run_at?: string | null;
};

/** Eligible member who may receive a report. */
export type ReportRecipient = {
  id: number;
  name: string;
  email: string;
};

export type Translate = (key: string) => string;

/**
 * Sections a schedule or one-off email can carry. Summary is the legacy eight-line metrics mail.
 */
export const SCHEDULE_SECTIONS: ScheduleSection[] = [
  "campaigns",
  "training",
  "checklists",
  "ticketing",
  "recipients",
  "users",
  "targets",
  "company",
  "summary",
];

export type ScheduleForm = {
  name: string;
  cadence: Cadence;
  format: ScheduleFormat;
  section: ScheduleSection;
  recipientIds: number[];
};

export function emptyScheduleForm(defaultName: string): ScheduleForm {
  return {
    name: defaultName,
    cadence: "monthly",
    format: "csv",
    section: "campaigns",
    recipientIds: [],
  };
}

export function scheduleFormFromSchedule(schedule: ReportSchedule): ScheduleForm {
  return {
    name: schedule.name,
    cadence: schedule.cadence,
    format: schedule.format,
    section: schedule.section,
    recipientIds: schedule.recipients.map((recipient) => recipient.id),
  };
}

/** Request body shared by create and update. */
export function scheduleRequestBody(form: ScheduleForm) {
  return {
    name: form.name,
    cadence: form.cadence,
    format: form.format,
    section: form.section,
    recipient_user_ids: form.recipientIds,
  };
}

export function isScheduleFormDirty(form: ScheduleForm, initial: ScheduleForm): boolean {
  return (
    form.name !== initial.name ||
    form.cadence !== initial.cadence ||
    form.format !== initial.format ||
    form.section !== initial.section ||
    form.recipientIds.length !== initial.recipientIds.length ||
    form.recipientIds.some((id) => !initial.recipientIds.includes(id))
  );
}

/**
 * PDF reports are monthly or quarterly only, so switching to PDF moves a weekly cadence to
 * monthly.
 */
export function nextCadenceForFormat(nextFormat: ScheduleFormat, current: Cadence): Cadence {
  return nextFormat === "pdf" && current === "weekly" ? "monthly" : current;
}

/** Current recipients who can no longer receive reports stay selectable so they can be removed. */
export function recipientPickerOptions(
  recipientOptions: ReportRecipient[],
  schedule: ReportSchedule | null,
): RecipientOption[] {
  if (schedule === null) {
    return recipientOptions;
  }
  const eligibleIds = new Set(recipientOptions.map((recipient) => recipient.id));
  const unavailable: RecipientOption[] = schedule.recipients
    .filter((recipient) => !eligibleIds.has(recipient.id))
    .map((recipient) => ({
      id: recipient.id,
      name: recipient.name ?? "",
      email: recipient.email ?? "",
      unavailable: true,
    }));
  return [...recipientOptions, ...unavailable];
}

/** Saving is blocked while any selected person has lost report access. */
export function hasUnavailableRecipients(
  recipientIds: number[],
  recipientOptions: ReportRecipient[],
): boolean {
  const eligibleIds = new Set(recipientOptions.map((recipient) => recipient.id));
  return recipientIds.some((id) => !eligibleIds.has(id));
}

export function selectedRecipientLabels(
  recipientIds: number[],
  options: RecipientOption[],
): string[] {
  return recipientIds.flatMap((id) => {
    const option = options.find((item) => item.id === id);
    return option ? [recipientName(option)] : [];
  });
}

export function recipientName(recipient: { name: string | null; email: string | null }): string {
  return recipient.name || recipient.email || "";
}

export function sectionLabel(section: ScheduleSection, t: Translate, tCommon: Translate): string {
  switch (section) {
    case "campaigns":
      return t("campaigns");
    case "training":
      return t("training");
    case "checklists":
      return t("checklists");
    case "ticketing":
      return t("ticketing");
    case "recipients":
      return tCommon("recipients");
    case "users":
      return tCommon("users");
    case "targets":
      return tCommon("employees");
    case "company":
      return t("company");
    case "summary":
      return t("sectionSummary");
    default: {
      const unhandled: never = section;
      return unhandled;
    }
  }
}

export function cadenceLabel(cadence: Cadence, tCommon: Translate): string {
  switch (cadence) {
    case "weekly":
      return tCommon("weekly");
    case "monthly":
      return tCommon("monthly");
    case "quarterly":
      return tCommon("quarterly");
    default: {
      const unhandled: never = cadence;
      return unhandled;
    }
  }
}

export function sectionOptions(
  t: Translate,
  tCommon: Translate,
): Array<{ value: ScheduleSection; label: string }> {
  return SCHEDULE_SECTIONS.map((value) => ({ value, label: sectionLabel(value, t, tCommon) }));
}
