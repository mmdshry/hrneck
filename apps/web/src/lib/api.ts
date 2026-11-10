import type { SessionUser } from "@/lib/session";

const API_BASE = "";

export const NO_ASSIGNED_TRAINING_MESSAGE =
  "No assigned training found for this account yet.";

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
      return status === 403
        ? NO_ASSIGNED_TRAINING_MESSAGE
        : `Request failed (${status})`;
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
    return NO_ASSIGNED_TRAINING_MESSAGE;
  }

  return `Request failed (${status})`;
}

export function xsrfHeaders(): HeadersInit {
  const token = xsrfToken();
  return token ? { "X-XSRF-TOKEN": token } : {};
}

export async function ensureCsrf(): Promise<void> {
  await fetch(`${API_BASE}/sanctum/csrf-cookie`, {
    credentials: "include",
  });
}

function xsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function api<T>(
  path: string,
  init: RequestInit & { tenant?: string } = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && !xsrfToken()) {
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

function normalizeSessionUser(raw: Partial<SessionUser> | null | undefined): SessionUser | null {
  if (!raw || typeof raw.email !== "string") {
    return null;
  }

  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? ""),
    email: raw.email,
    tenant_id: raw.tenant_id ?? null,
    roles: Array.isArray(raw.roles) ? raw.roles.map(String) : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map(String) : [],
    is_platform_staff: Boolean(raw.is_platform_staff),
    mfa_enabled: Boolean(raw.mfa_enabled),
    staff_tenant_id: raw.staff_tenant_id ?? null,
    acting_in_tenant: Boolean(raw.acting_in_tenant),
  };
}

export async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    await ensureCsrf();
    const res = await api<{ data?: SessionUser } & Partial<SessionUser>>("/api/v1/auth/me");
    return normalizeSessionUser((res.data ?? res) as SessionUser);
  } catch (err) {
    if (err instanceof ApiError && err.status === 419) {
      try {
        await ensureCsrf();
        const res = await api<{ data?: SessionUser } & Partial<SessionUser>>("/api/v1/auth/me");
        return normalizeSessionUser((res.data ?? res) as SessionUser);
      } catch (retryErr) {
        if (retryErr instanceof ApiError && (retryErr.status === 401 || retryErr.status === 419)) {
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

export async function signOut(): Promise<void> {
  await ensureCsrf();
  try {
    await api("/api/v1/auth/logout", { method: "POST" });
  } catch (err) {
    // Already unauthenticated is fine; CSRF/other failures must surface.
    if (err instanceof ApiError && err.status === 401) {
      return;
    }
    throw err;
  }
}
