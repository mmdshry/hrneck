const DEFAULT_TENANT = "itneck";

const APP_HOST_LABELS = new Set(["app", "www", "localhost", "127", "admin", "api"]);

export function resolveTenant(): string {
  if (typeof window === "undefined") {
    return DEFAULT_TENANT;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("tenant");
  if (fromQuery) {
    window.localStorage.setItem("hrneck_tenant", fromQuery);
    return fromQuery;
  }

  // On a tenant subdomain, the host is authoritative over stale MSP localStorage.
  const host = window.location.hostname;
  const label = host.split(".")[0] ?? "";
  if (label && !APP_HOST_LABELS.has(label)) {
    return label;
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
