import { expect, test } from "@playwright/test";
import { loginAsPlatformAdmin } from "./helpers/auth";

test("client navigation keeps a single main landmark", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsPlatformAdmin(page);

  const openTenant = page.getByRole("button", { name: "Open tenant admin" }).first();
  await expect(openTenant).toBeVisible({ timeout: 20_000 });
  await openTenant.click();
  await page.waitForURL(/\/org/, { timeout: 30_000 });
  await expect(page.locator("#main-content")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Organizations" })).toHaveCount(0);
  await page.goto("/org/ticketing");
  await expect(page.getByRole("heading", { name: "Ticketing" })).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/login/, { timeout: 20_000 }),
    page.locator("button", { hasText: "Sign out" }).evaluate((button) => {
      (button as HTMLButtonElement).click();
    }),
  ]);

  await expect(page.locator("#main-content")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Ticketing" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Organizations" })).toHaveCount(0);
});
