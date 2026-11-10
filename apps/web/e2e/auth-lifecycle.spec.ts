import { test, expect } from "@playwright/test";
import { loginAsOrgAdmin, loginAsPlatformAdmin } from "./helpers/auth";

test.describe("Auth lifecycle", () => {
  test("unauthenticated /org redirects to login", async ({ page }) => {
    await page.goto("/org");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("unauthenticated /portal redirects to login", async ({ page }) => {
    await page.goto("/portal/tickets");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("org admin can sign out", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);
    await page.getByRole("button", { name: /sign out/i }).first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("platform staff can enter tenant admin", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsPlatformAdmin(page);
    await page.getByRole("button", { name: /open tenant admin/i }).first().click();
    await page.waitForURL(/\/org/, { timeout: 30_000 });
    await expect(page.getByText(/viewing as platform staff/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("link", { name: "Users" }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Ticketing" }).first()).toBeVisible();
  });
});
