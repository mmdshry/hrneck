import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/msp", "/org", "/learn"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!needsAuth) {
    return NextResponse.next();
  }

  // Soft gate: product pages remain reachable in local demo; hardened auth
  // is enforced by API + Playwright flows.
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
  matcher: ["/msp/:path*", "/org/:path*", "/learn/:path*", "/login"],
};
