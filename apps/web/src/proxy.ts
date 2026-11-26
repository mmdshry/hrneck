import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  canAccessMsp,
  defaultPostLoginPath,
  resolvePostLoginPath,
  type OrgMembership,
  type PostLoginUser,
  type StaffGateUser,
} from "@/lib/session";

const PROTECTED = ["/msp", "/org", "/portal"];
const LOGIN_FLOW = ["/login/mfa", "/login/forgot", "/login/reset", "/login/sso"];

function isProtected(pathname: string): boolean {
  return PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isLoginFlow(pathname: string): boolean {
  return LOGIN_FLOW.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isMspPath(pathname: string): boolean {
  return pathname === "/msp" || pathname.startsWith("/msp/");
}

function apiOrigin(): string {
  return process.env.API_ORIGIN ?? "http://127.0.0.1:8000";
}

/**
 * Public browser origin for Sanctum stateful checks.
 * Behind Apache ProxyPass, request.nextUrl.origin is often http://127.0.0.1:3100,
 * which Sanctum does not treat as stateful — /auth/me then returns { data: null }
 * and the gate bounces authenticated users back to /login.
 */
function publicOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }
  const forwardedHost = (
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? ""
  )
    .split(",")[0]
    ?.trim();
  const proto = (
    request.headers.get("x-forwarded-proto") ?? "https"
  )
    .split(",")[0]
    ?.trim();
  if (forwardedHost && proto) {
    return `${proto}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

type MeUser = {
  email?: unknown;
  tenant_id?: unknown;
  is_platform_staff?: unknown;
  memberships?: unknown;
  needs_org_selection?: unknown;
  has_org_access?: unknown;
};

function staffGateUser(user: MeUser): StaffGateUser {
  return { is_platform_staff: user.is_platform_staff === true };
}

function postLoginUser(user: MeUser): PostLoginUser {
  const memberships: OrgMembership[] | undefined = Array.isArray(user.memberships)
    ? user.memberships.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null) {
          return [];
        }
        const tenantId =
          typeof (entry as { tenant_id?: unknown }).tenant_id === "string"
            ? (entry as { tenant_id: string }).tenant_id.trim()
            : "";
        if (!tenantId) {
          return [];
        }
        const name =
          typeof (entry as { name?: unknown }).name === "string"
            ? (entry as { name: string }).name
            : tenantId;
        return [{ tenant_id: tenantId, name }];
      })
    : undefined;

  return {
    is_platform_staff: user.is_platform_staff === true,
    tenant_id: typeof user.tenant_id === "string" ? user.tenant_id : null,
    memberships,
    needs_org_selection: user.needs_org_selection === true,
    has_org_access: user.has_org_access === true,
  };
}

async function sessionUser(request: NextRequest): Promise<MeUser | null> {
  try {
    const origin = publicOrigin(request);
    const response = await fetch(`${apiOrigin()}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: request.headers.get("cookie") ?? "",
        Origin: origin,
        Referer: `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`,
        "X-Requested-With": "XMLHttpRequest",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as { data?: MeUser | null };
    const user = json.data;
    if (!user || typeof user.email !== "string" || user.email.length === 0) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = isProtected(pathname);

  if (pathname === "/login") {
    const user = await sessionUser(request);
    if (user) {
      const next = request.nextUrl.searchParams.get("next");
      const dest = resolvePostLoginPath(postLoginUser(user), next);
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // MFA / forgot / reset must stay reachable for guests and mid-flow users.
  if (isLoginFlow(pathname)) {
    return NextResponse.next();
  }

  if (needsAuth) {
    const user = await sessionUser(request);
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    if (isMspPath(pathname) && !canAccessMsp(staffGateUser(user))) {
      return NextResponse.redirect(new URL(defaultPostLoginPath(postLoginUser(user)), request.url));
    }
  }

  const response = NextResponse.next();
  const host = (request.headers.get("host") ?? "hrneck.test").split(":")[0];
  const labels = host.split(".");
  // Apex hrneck.test is central; tenant hosts are {slug}.hrneck.test (3+ labels).
  if (labels.length >= 3) {
    const tenant = labels[0];
    if (tenant && !["app", "admin", "api", "mail", "www"].includes(tenant)) {
      response.headers.set("x-hrneck-tenant", tenant);
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/msp/:path*",
    "/org/:path*",
    "/portal/:path*",
    "/login",
    "/login/:path*",
  ],
};
