import type { SessionUser } from "@/lib/session";

const API_BASE = "";

export const NO_ASSIGNED_TRAINING_MESSAGE =
  "No assigned training found for this account yet.";

const SIGN_IN_MESSAGE =
  "Sign in required. Use Sign in in the sidebar (admin@itneck.test).";

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

export function friendlyMessage(status: number, body: string): string {
  if (status === 401 || status === 419) {
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
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  const token = xsrfToken();
  if (token) headers.set("X-XSRF-TOKEN", token);
  if (init.tenant) headers.set("X-Tenant", init.tenant);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
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

export async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    await ensureCsrf();
    const res = await api<{ data?: SessionUser } & Partial<SessionUser>>("/api/v1/auth/me");
    const user = (res.data ?? res) as SessionUser;
    if (user && typeof user.email === "string") {
      return {
        id: Number(user.id ?? 0),
        name: String(user.name ?? ""),
        email: user.email,
        tenant_id: user.tenant_id ?? null,
        roles: Array.isArray(user.roles) ? user.roles.map(String) : [],
        permissions: Array.isArray(user.permissions) ? user.permissions.map(String) : [],
        is_platform_staff: Boolean(user.is_platform_staff),
        mfa_enabled: Boolean(user.mfa_enabled),
      };
    }
    return null;
  } catch {
    return null;
  }
}
