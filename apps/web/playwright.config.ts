import { defineConfig, devices } from "@playwright/test";

const useSystemChrome = !process.env.CI && process.env.PLAYWRIGHT_USE_CHROME !== "0";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: /tenant-hosts\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
      },
    },
    {
      name: "mobile-chrome",
      testIgnore: /tenant-hosts\.spec\.ts/,
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
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
