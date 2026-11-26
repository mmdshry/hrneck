import { useBranding } from "@/components/branding-provider";
import { resolveTimeZone } from "@/lib/format-datetime";

/** The organization (tenant) timezone from branding. Falls back to UTC until branding loads. */
export function useOrgTimezone(): string {
  const { branding } = useBranding();
  return resolveTimeZone(branding?.timezone);
}
