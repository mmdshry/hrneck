import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
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

export default nextConfig;
