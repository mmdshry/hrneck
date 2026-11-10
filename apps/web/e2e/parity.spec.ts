import { test, expect } from "@playwright/test";

test.describe("Parity shells", () => {
  test("training campaigns requires sign in", async ({ page }) => {
    await page.goto("/org/training/campaigns");
    await expect(page).toHaveURL(/\/login/);
  });

  test("report export requires sign in", async ({ page }) => {
    await page.goto("/org/reports/export");
    await expect(page).toHaveURL(/\/login/);
  });

  test("integrations, targets, and groups require sign in", async ({ page }) => {
    await page.goto("/org/settings/integrations");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/org/targets");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/org/groups");
    await expect(page).toHaveURL(/\/login/);
  });
});
