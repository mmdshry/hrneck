const DEFAULT_TENANT = "itneck";

/** Reserved first labels on `{label}.hrneck.test` — not tenant slugs. */
const RESERVED_HOST_LABELS = new Set([
  "app",
  "www",
  "localhost",
  "127",
  "admin",
  "api",
  "mail",
]);

/**
 * Tenant slug from a host, matching Next proxy:
 * apex `hrneck.test` is central; only `{slug}.hrneck.test` (3+ labels) is authoritative.
 */
export function tenantFromHostname(hostname: string): string | null {
  const host = hostname.split(":")[0] ?? "";
  const labels = host.split(".").filter(Boolean);
  // Apex / two-label central hosts (e.g. hrneck.test) are not tenants.
  if (labels.length < 3) {
    return null;
  }
  const label = labels[0] ?? "";
  if (!label || RESERVED_HOST_LABELS.has(label)) {
    return null;
  }
  return label;
}

/** First label of the platform staff host, `app.{base}`. Matches `STAFF_HOST` on the API. */
const PLATFORM_HOST_LABEL = "app";

/**
 * Which sign-in surface a host serves:
 * - `{slug}.{base}`: an organization, which signs in with its own password.
 * - `app.{base}`: platform staff only.
 * - anything else (the apex, `www`, localhost): the main site, which only helps people find their organization.
 */
export type HostKind = "organization" | "platform" | "central";

export function hostKind(hostname: string): HostKind {
  const host = (hostname.split(":")[0] ?? "").trim().toLowerCase();
  const labels = host.split(".").filter(Boolean);
  if (labels.length >= 3 && labels[0] === PLATFORM_HOST_LABEL) {
    return "platform";
  }
  return tenantFromHostname(host) ? "organization" : "central";
}

/**
 * Host the browser asked for, as the server sees it. Behind Apache or Caddy the forwarded host wins,
 * matching the public-origin logic in the proxy.
 */
export function requestHost(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-host") ?? headers.get("host") ?? "";
  return forwarded.split(",")[0]?.trim() ?? "";
}

const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * The organization slug from what someone typed on the main site: `itneck`, `itneck.hrneck.com`,
 * or a pasted address such as `https://itneck.hrneck.com/login`. Returns null if it cannot be a slug.
 */
export function organizationSlugFromInput(input: string): string | null {
  const bare = input.trim().toLowerCase().replace(/^https?:\/\//, "");
  const host = bare.split(/[/?#]/)[0] ?? "";
  const label = host.split(".")[0] ?? "";
  return ORGANIZATION_SLUG_PATTERN.test(label) ? label : null;
}

export function resolveTenant(preferred?: string | null): string {
  if (typeof window === "undefined") {
    return preferred || DEFAULT_TENANT;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("tenant");
  if (fromQuery) {
    window.localStorage.setItem("hrneck_tenant", fromQuery);
    return fromQuery;
  }

  // On a tenant subdomain, the host is authoritative over stale MSP localStorage.
  const fromHost = tenantFromHostname(window.location.hostname);
  if (fromHost) {
    return fromHost;
  }

  if (preferred) {
    window.localStorage.setItem("hrneck_tenant", preferred);
    return preferred;
  }

  const stored = window.localStorage.getItem("hrneck_tenant");
  if (stored) {
    return stored;
  }

  return DEFAULT_TENANT;
}

export function setTenant(slug: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("hrneck_tenant", slug);
}

export function clearTenant(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("hrneck_tenant");
}

/** Apex base domain for `{slug}.{base}` tenant hosts (e.g. `hrneck.test`). */
export function tenancyBaseDomain(hostname?: string): string {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "")).split(
    ":",
  )[0];
  const labels = host.split(".").filter(Boolean);
  if (labels.length >= 3) {
    return labels.slice(1).join(".");
  }
  if (labels.length === 2) {
    return host;
  }
  return "hrneck.test";
}

/** Absolute URL to the same path on another tenant subdomain. */
export function tenantWorkspaceUrl(
  tenantId: string,
  path: string,
  options?: { search?: string; hostname?: string; protocol?: string; port?: string },
): string {
  const base = tenancyBaseDomain(options?.hostname);
  const protocol =
    options?.protocol ??
    (typeof window !== "undefined" ? window.location.protocol : "https:");
  const port =
    options?.port ??
    (typeof window !== "undefined" && window.location.port
      ? `:${window.location.port}`
      : "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const search = options?.search ?? "";
  return `${protocol}//${tenantId}.${base}${port}${normalizedPath}${search}`;
}
