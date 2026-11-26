import type {
  SessionSubscription,
  SessionUser,
  SubscriptionStatus,
  SubscriptionUsageItem,
} from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";

const API_BASE = "";

export const NO_ASSIGNED_TRAINING_MESSAGE =
  "No assigned training found for this account yet.";

/** Shown for a 403 when the server sent no message that is safe to display. */
export const FORBIDDEN_MESSAGE = "You do not have permission to do this.";

const SIGN_IN_MESSAGE = "Sign in required to continue.";
const CSRF_MESSAGE = "Your session expired. Refresh the page and try again.";

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(friendlyMessage(status, body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function firstValidationError(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
      errors?: Record<string, string[] | string>;
    };
    if (parsed.errors && typeof parsed.errors === "object") {
      for (const value of Object.values(parsed.errors)) {
        if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
          return value[0].trim();
        }
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function friendlyMessage(status: number, body: string): string {
  if (status === 419) {
    return CSRF_MESSAGE;
  }

  const validation = firstValidationError(body);
  if (validation && validation !== "Unauthenticated.") {
    return validation;
  }

  if (status === 401 || validation === "Unauthenticated.") {
    return SIGN_IN_MESSAGE;
  }

  let message = "";
  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
      exception?: unknown;
      trace?: unknown;
    };
    if (parsed.exception !== undefined || parsed.trace !== undefined) {
      message = "";
    }
    if (typeof parsed.message === "string") {
      message = parsed.message.trim();
    }
  } catch {
    if (body.includes("Exception") || body.includes('"trace"')) {
      return status === 403 ? FORBIDDEN_MESSAGE : `Request failed (${status})`;
    }
  }

  if (message === "Unauthenticated.") {
    return SIGN_IN_MESSAGE;
  }

  const usable =
    message !== "" &&
    !message.includes("Symfony\\") &&
    !message.includes("vendor\\") &&
    !message.includes("stack trace");

  if (usable) {
    return message;
  }

  if (status === 403) {
    return FORBIDDEN_MESSAGE;
  }

  return `Request failed (${status})`;
}

export function xsrfHeaders(): HeadersInit {
  const token = xsrfToken();
  return token ? { "X-XSRF-TOKEN": token } : {};
}

let csrfFlight: Promise<void> | null = null;

function xsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isSafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

/** Always hits `/sanctum/csrf-cookie`. Concurrent callers share one request. */
function refreshCsrf(): Promise<void> {
  if (csrfFlight) return csrfFlight;

  const flight = fetch(`${API_BASE}/sanctum/csrf-cookie`, {
    credentials: "include",
  }).then(() => undefined);

  csrfFlight = flight;
  const release = () => {
    if (csrfFlight === flight) csrfFlight = null;
  };
  void flight.then(release, release);
  return flight;
}

export async function ensureCsrf(): Promise<void> {
  if (xsrfToken()) return;
  await refreshCsrf();
}

let sessionCache: SessionUser | null = null;
/** Tenant the cached session was loaded for. Permissions differ per organization. */
let sessionCacheTenant: string | null = null;
let sessionFlight: Promise<SessionUser | null> | null = null;
let sessionFlightTenant: string | null = null;
let sessionEpoch = 0;

export function invalidateSessionUser(): void {
  sessionEpoch += 1;
  sessionCache = null;
  sessionCacheTenant = null;
  sessionFlight = null;
  sessionFlightTenant = null;
}

/** Keep cached session locale in sync after a successful language switch. */
export function patchSessionLocale(locale: string): void {
  if (!sessionCache) return;
  sessionCache = { ...sessionCache, locale };
}

function invalidateSessionCache(): void {
  invalidateSessionUser();
}

export async function api<T>(
  path: string,
  init: RequestInit & { tenant?: string } = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (!isSafeMethod(method) && !xsrfToken()) {
    await ensureCsrf();
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  const token = xsrfToken();
  if (token) headers.set("X-XSRF-TOKEN", token);
  if (init.tenant) headers.set("X-Tenant", init.tenant);

  const { tenant: _tenant, ...fetchInit } = init;

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchInit,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body || response.statusText);
  }

  // Mutations can change /auth/me (MFA, profile). Drop the cached user so the next read is fresh.
  if (!isSafeMethod(method)) {
    invalidateSessionCache();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** Like `api`, but returns null on 401/403 so optional side-loads cannot fail the page. */
export async function apiOptional<T>(
  path: string,
  init: RequestInit & { tenant?: string } = {},
): Promise<T | null> {
  try {
    return await api<T>(path, init);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return null;
    }
    throw err;
  }
}

const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "trial",
  "active",
  "suspended",
  "expired",
];

function subscriptionStatus(raw: unknown): SubscriptionStatus | null {
  return SUBSCRIPTION_STATUSES.find((status) => status === raw) ?? null;
}

function normalizeSubscriptionUsage(raw: unknown): SubscriptionUsageItem {
  const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const used = Number(item.used);
  const limit =
    item.limit === null || item.limit === undefined ? null : Number(item.limit);
  return {
    used: Number.isFinite(used) ? used : 0,
    limit: limit !== null && Number.isFinite(limit) ? limit : null,
    over_limit: item.over_limit === true,
  };
}

/** Spread into the session user only when /auth/me sent a subscription block. */
function optionalSubscription(raw: unknown): { subscription?: SessionSubscription } {
  if (!raw || typeof raw !== "object") return {};
  const item = raw as Record<string, unknown>;
  const usage = (
    item.usage && typeof item.usage === "object" ? item.usage : {}
  ) as Record<string, unknown>;
  return {
    subscription: {
      plan_name: typeof item.plan_name === "string" ? item.plan_name : null,
      status: subscriptionStatus(item.status),
      effective_status: subscriptionStatus(item.effective_status),
      read_only: item.read_only === true,
      ends_at: typeof item.ends_at === "string" ? item.ends_at : null,
      over_limit: item.over_limit === true,
      usage: {
        employees: normalizeSubscriptionUsage(usage.employees),
        users: normalizeSubscriptionUsage(usage.users),
      },
    },
  };
}

const SESSION_LOCALES = new Set(["en", "es", "fr", "pt", "de", "ru"]);

function normalizeSessionUser(raw: Partial<SessionUser> | null | undefined): SessionUser | null {
  if (!raw || typeof raw.email !== "string") {
    return null;
  }

  const localeRaw =
    typeof raw.locale === "string" ? raw.locale.trim().toLowerCase() : null;

  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? ""),
    email: raw.email,
    tenant_id: raw.tenant_id ?? null,
    department_id:
      raw.department_id === null || raw.department_id === undefined
        ? null
        : Number(raw.department_id),
    department:
      typeof raw.department === "string" && raw.department.trim() !== ""
        ? raw.department.trim()
        : null,
    job_title:
      typeof raw.job_title === "string" && raw.job_title.trim() !== ""
        ? raw.job_title.trim()
        : null,
    target_department:
      typeof raw.target_department === "string" && raw.target_department.trim() !== ""
        ? raw.target_department.trim()
        : null,
    avatar_url:
      typeof raw.avatar_url === "string" && raw.avatar_url.trim() !== ""
        ? raw.avatar_url.trim()
        : null,
    avatar_path:
      typeof raw.avatar_path === "string" && raw.avatar_path.trim() !== ""
        ? raw.avatar_path.trim()
        : null,
    roles: Array.isArray(raw.roles) ? raw.roles.map(String) : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map(String) : [],
    is_platform_staff: Boolean(raw.is_platform_staff),
    mfa_enabled: Boolean(raw.mfa_enabled),
    mfa_totp_enabled: Boolean(raw.mfa_totp_enabled),
    locale: localeRaw && SESSION_LOCALES.has(localeRaw) ? localeRaw : null,
    staff_tenant_id: raw.staff_tenant_id ?? null,
    acting_in_tenant: Boolean(raw.acting_in_tenant),
    memberships: Array.isArray(raw.memberships)
      ? raw.memberships
          .map((m) => {
            if (!m || typeof m !== "object") return null;
            const tenantId =
              typeof m.tenant_id === "string" ? m.tenant_id.trim() : "";
            if (!tenantId) return null;
            return {
              tenant_id: tenantId,
              name:
                typeof m.name === "string" && m.name.trim() !== ""
                  ? m.name.trim()
                  : tenantId,
              department_id:
                m.department_id === null || m.department_id === undefined
                  ? null
                  : Number(m.department_id),
              department:
                typeof m.department === "string" && m.department.trim() !== ""
                  ? m.department.trim()
                  : null,
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null)
      : undefined,
    organizations: Array.isArray(raw.organizations)
      ? raw.organizations
          .map((o) => {
            if (!o || typeof o !== "object") return null;
            const tenantId =
              typeof o.tenant_id === "string" ? o.tenant_id.trim() : "";
            if (!tenantId) return null;
            return {
              tenant_id: tenantId,
              name:
                typeof o.name === "string" && o.name.trim() !== ""
                  ? o.name.trim()
                  : tenantId,
              requires_password: Boolean(o.requires_password),
            };
          })
          .filter((o): o is NonNullable<typeof o> => o !== null)
      : undefined,
    needs_org_selection: Boolean(raw.needs_org_selection),
    ...optionalSubscription(raw.subscription),
    active_tenant_id:
      typeof raw.active_tenant_id === "string" && raw.active_tenant_id.trim() !== ""
        ? raw.active_tenant_id.trim()
        : null,
  };
}

async function requestSessionUser(): Promise<SessionUser | null> {
  const res = await api<{ data?: SessionUser } & Partial<SessionUser>>("/api/v1/auth/me");
  return normalizeSessionUser((res.data ?? res) as SessionUser);
}

async function loadSessionUser(): Promise<SessionUser | null> {
  try {
    return await requestSessionUser();
  } catch (err) {
    if (err instanceof ApiError && err.status === 419) {
      try {
        await refreshCsrf();
        return await requestSessionUser();
      } catch (retryErr) {
        if (
          retryErr instanceof ApiError &&
          (retryErr.status === 401 || retryErr.status === 419)
        ) {
          return null;
        }
        throw retryErr;
      }
    }
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}

function startSessionLoad(epoch: number, tenant: string): Promise<SessionUser | null> {
  const flight = loadSessionUser().then((user) => {
    if (epoch === sessionEpoch && user) {
      sessionCache = user;
      sessionCacheTenant = tenant;
    }
    return user;
  });
  sessionFlight = flight;
  sessionFlightTenant = tenant;
  const release = () => {
    if (sessionFlight === flight) {
      sessionFlight = null;
      sessionFlightTenant = null;
    }
  };
  void flight.then(release, release);
  return flight;
}

export async function fetchSessionUser(): Promise<SessionUser | null> {
  const tenant = resolveTenant();
  if (sessionCache && sessionCacheTenant === tenant) return sessionCache;

  const epoch = sessionEpoch;
  if (!sessionFlight || sessionFlightTenant !== tenant) {
    return startSessionLoad(epoch, tenant);
  }

  return sessionFlight;
}

export async function signOut(): Promise<void> {
  invalidateSessionCache();
  await ensureCsrf();
  try {
    await api("/api/v1/auth/logout", { method: "POST" });
  } catch (err) {
    // Already unauthenticated is fine; CSRF/other failures must surface.
    if (err instanceof ApiError && err.status === 401) {
      invalidateSessionCache();
      return;
    }
    throw err;
  }
}
