import { test, expect } from "@playwright/test";
import dns from "node:dns/promises";

async function tenantHostResolves(hostname: string): Promise<boolean> {
  try {
    const addresses = await dns.lookup(hostname);
    return Boolean(addresses.address);
  } catch {
    return false;
  }
}

test.describe("tenant host shells", () => {
  test.beforeAll(async () => {
    const hostname = new URL(
      process.env.PLAYWRIGHT_TENANT_URL ?? "http://itneck.hrneck.test",
    ).hostname;
    test.skip(
      !(await tenantHostResolves(hostname)),
      `Add 127.0.0.1 ${hostname} to the system hosts file (admin) before running tenant-hosts.`,
    );
  });

  test("itneck org shell requires sign in", async ({ page }) => {
    await page.goto("/org");
    await expect(page).toHaveURL(/\/login/);
  });

  test("learner portal renders sample course", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel("Email");
    const password = page.getByLabel("Password");
    await email.fill("");
    await email.pressSequentially("admin@itneck.test", { delay: 15 });
    await password.fill("");
    await password.pressSequentially("DemoPass!234", { delay: 15 });
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/learner portal|security fundamentals|progress|assigned/i).first(),
    ).toBeVisible();
  });
});
