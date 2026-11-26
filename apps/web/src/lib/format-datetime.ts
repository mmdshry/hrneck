/**
 * Date and time formatting for the organization (tenant) timezone.
 *
 * Timestamps arrive from the API as absolute ISO-8601 instants (UTC). They must
 * be rendered in the organization timezone, never in the viewer's browser zone.
 */

export const FALLBACK_TIME_ZONE = "UTC";

/** Returns a valid IANA timezone name, or UTC when the value is missing or unknown. */
export function resolveTimeZone(value: string | null | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return FALLBACK_TIME_ZONE;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Locale-formatted date and time in the organization timezone.
 * Returns an empty string when the value is missing or not a valid date.
 */
export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone: string | null | undefined,
  locale?: string,
): string {
  const date = toValidDate(value);
  if (!date) return "";
  return date.toLocaleString(locale, { timeZone: resolveTimeZone(timeZone) });
}

/**
 * Fixed `YYYY-MM-DD HH:mm:ss` in the organization timezone, for compact table cells.
 * Returns an empty string when the value is missing or not a valid date.
 */
export function formatDateTimeCompact(
  value: string | Date | null | undefined,
  timeZone: string | null | undefined,
): string {
  const date = toValidDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}
