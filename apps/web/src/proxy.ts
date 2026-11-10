import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  canAccessMsp,
  resolvePostLoginPath,
  type StaffGateUser,
} from "@/lib/session";

const PROTECTED = ["/msp", "/org", "/learn", "/portal"];
const LOGIN_FLOW = ["/login/mfa", "/login/forgot", "/login/reset"];

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

type MeUser = {
  email?: unknown;
  tenant_id?: unknown;
  is_platform_staff?: unknown;
};

function staffGateUser(user: MeUser): StaffGateUser {
  return { is_platform_staff: user.is_platform_staff === true };
}

async function sessionUser(request: NextRequest): Promise<MeUser | null> {
  try {
    const response = await fetch(`${apiOrigin()}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: request.headers.get("cookie") ?? "",
        Origin: request.nextUrl.origin,
        Referer: request.nextUrl.href,
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
      const dest = resolvePostLoginPath(staffGateUser(user), next);
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
      return NextResponse.redirect(new URL("/org", request.url));
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
    "/learn/:path*",
    "/portal/:path*",
    "/login",
    "/login/:path*",
  ],
};
