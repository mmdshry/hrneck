import { ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import type { ReportSection } from "./report-types";

/** Mirrors BuildOrgDetailedReport::CSV_ROW_CAP on the API; used only to word the truncation warning. */
export const REPORT_CSV_ROW_CAP = 5000;

export type ReportCsvResult = {
  /** True when the section has more rows than the CSV cap, so the file stops early. */
  truncated: boolean;
};

export async function downloadReportCsv(
  section: ReportSection,
  filters: Record<string, string | number | undefined | null> = {},
): Promise<ReportCsvResult> {
  await ensureCsrf();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  const path = `/api/v1/org/reports/detailed/${section}/csv${qs ? `?${qs}` : ""}`;
  const res = await fetch(path, {
    credentials: "include",
    headers: { "X-Tenant": resolveTenant() ?? "" },
  });
  if (!res.ok) {
    throw new Error(`CSV export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `org-report-${section}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  return { truncated: res.headers.get("X-Report-Truncated") === "1" };
}
