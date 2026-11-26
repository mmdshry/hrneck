import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: [
    "hrneck.test",
    "app.hrneck.test",
    "itneck.hrneck.test",
    "test.hrneck.test",
    "company.hrneck.test",
    "*.hrneck.test",
  ],
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      // Turnstile renders its challenge inside this iframe.
      "frame-src https://challenges.cloudflare.com",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Login accounts and employees are one list now (Employees), with roles shown per row.
      { source: "/org/users", destination: "/org/targets", permanent: false },
      // The learner portal is the employee dashboard now; query strings (course, enrollment, target) carry over.
      { source: "/learn", destination: "/portal", permanent: false },
      { source: "/learn/:path*", destination: "/portal", permanent: false },
      // Knowledge base is its own workspace section with its own permissions.
      { source: "/org/ticketing/kb", destination: "/org/kb", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/sanctum/:path*", destination: `${apiOrigin}/sanctum/:path*` },
      { source: "/broadcasting/:path*", destination: `${apiOrigin}/broadcasting/:path*` },
      { source: "/t/:path*", destination: `${apiOrigin}/t/:path*` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
