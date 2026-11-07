export type OrgBranding = {
  display_name?: string | null;
  primary_color?: string | null;
  logo_path?: string | null;
  logo_url?: string | null;
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

/** Expand #abc → #aabbcc */
export function normalizeHex(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return v.toLowerCase();
}

export function applyPrimaryColor(color: string | null | undefined): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!isValidHexColor(color)) {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--color-primary");
    root.style.removeProperty("--color-ring");
    return;
  }
  const hex = normalizeHex(color);
  root.style.setProperty("--primary", hex);
  root.style.setProperty("--ring", hex);
  root.style.setProperty("--color-primary", hex);
  root.style.setProperty("--color-ring", hex);
}

export function clearPrimaryColor(): void {
  applyPrimaryColor(null);
}

export function brandDisplayName(
  branding: OrgBranding | null | undefined,
  fallback = "HRNECK",
): string {
  const name = branding?.display_name?.trim();
  return name && name.length > 0 ? name : fallback;
}
