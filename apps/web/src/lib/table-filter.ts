/**
 * Client-side row filter shared by org list pages.
 *
 * `q` is a case-insensitive substring match against the joined values of all
 * `cells`. Each `columnFilters` entry is a case-insensitive substring match
 * against `cells[key]`. Blank (whitespace-only) filter values are ignored, and
 * a missing cell key is treated as an empty string.
 */
export function matchesCells(
  q: string,
  columnFilters: Record<string, string>,
  cells: Record<string, string>,
): boolean {
  const needle = q.trim().toLowerCase();
  if (needle && !Object.values(cells).join(" ").toLowerCase().includes(needle)) {
    return false;
  }
  for (const [key, raw] of Object.entries(columnFilters)) {
    const value = raw.trim().toLowerCase();
    if (!value) continue;
    if (!String(cells[key] ?? "").toLowerCase().includes(value)) return false;
  }
  return true;
}
