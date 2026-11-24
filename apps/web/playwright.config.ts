import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const useSystemChrome = !process.env.CI && process.env.PLAYWRIGHT_USE_CHROME !== "0";

// Keep 3100: apps/api/.env.example lists only 127.0.0.1:3100 in SANCTUM_STATEFUL_DOMAINS,
// so a different port would break cookie-based login.
const e2ePort = 3100;
const e2eUrl = `http://127.0.0.1:${e2ePort}`;

// Default: `next start` against a production build (same as CI).
// PLAYWRIGHT_DEV_SERVER=1 keeps the old `next dev` server for local debugging.
const useDevServer = process.env.PLAYWRIGHT_DEV_SERVER === "1";
const productionBuildMarker = path.join(__dirname, ".next", "BUILD_ID");

if (!process.env.PLAYWRIGHT_BASE_URL && !useDevServer && !fs.existsSync(productionBuildMarker)) {
  throw new Error(
    "No production build found in apps/web/.next. Run `pnpm --dir apps/web build` first, " +
      "or set PLAYWRIGHT_DEV_SERVER=1 to test against `next dev`.",
  );
}

const webServer = useDevServer
  ? {
      command: `pnpm dev --hostname 127.0.0.1 --port ${e2ePort}`,
      url: e2eUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    }
  : {
      command: `pnpm start --hostname 127.0.0.1 --port ${e2ePort}`,
      url: e2eUrl,
      // Never test against a leftover server (possibly a dev build or stale code) on this port.
      reuseExistingServer: false,
      timeout: 120_000,
    };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Sequential workers avoid auth rate-limit flakes against a shared local API.
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? e2eUrl,
    trace: "on-first-retry",
  },
  projects: [
    {
      // Logs in once per run and saves storage state for the projects below.
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
      },
    },
    {
      name: "desktop-chromium",
      dependencies: ["setup"],
      testIgnore: /tenant-hosts\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
      },
    },
    {
      name: "mobile-chrome",
      dependencies: ["setup"],
      // Keep mobile focused on shell/smoke coverage. Heavy API-mutating specs stay
      // on desktop so php artisan serve is less likely to die mid-suite in CI.
      testIgnore: [
        /tenant-hosts\.spec\.ts/,
        /learner\.spec\.ts/,
        /password-reset\.spec\.ts/,
        /targets-import\.spec\.ts/,
        /ticketing-advanced\.spec\.ts/,
        // Covered on desktop; mobile drawer auth footer is easy to flake in CI.
        /auth-lifecycle\.spec\.ts/,
      ],
      use: {
        ...devices["Pixel 7"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
      },
    },
    {
      name: "tenant-hosts",
      testMatch: /tenant-hosts\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
        baseURL: process.env.PLAYWRIGHT_TENANT_URL ?? "http://itneck.hrneck.test",
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : webServer,
});
