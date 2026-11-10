import { test, expect } from "@playwright/test";
import { loginAsOrgAdmin } from "./helpers/auth";


test.describe("DataTable filters", () => {
  test("ticketing queue exposes search and column filters", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);
    await page.goto("/org/ticketing");
    await expect(page.getByRole("heading", { name: "Ticketing" })).toBeVisible();
    // Empty queues render EmptyState (no column filter row). Seed one ticket first.
    await page.locator("#summary").fill(`Filter seed ${Date.now()}`);
    await page.getByRole("button", { name: "Create ticket" }).click();
    await page.waitForURL(/\/org\/ticketing\/tickets\/\d+/, { timeout: 30_000 });
    await page.goto("/org/ticketing");
    await expect(page.getByLabel("Search table")).toBeVisible();
    // Column filters sit in a desktop table row; on mobile they live in a sheet.
    const filterNumber = page.getByLabel("Filter Number");
    if (!(await filterNumber.first().isVisible())) {
      await page.getByRole("button", { name: /^Filters/i }).click();
    }
    await expect(filterNumber.first()).toBeVisible();
    await page.getByLabel("Search table").fill("INC");
    await expect(page.getByLabel("Search table")).toHaveValue("INC");
  });

  test("reports users section has searchable DataTable", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);
    await page.goto("/org/reports");
    await expect(page.getByRole("heading", { name: /Reports/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    const usersTab = page.getByRole("tab", { name: /Users/i }).or(
      page.getByRole("button", { name: /Users/i }),
    );
    if (await usersTab.count()) {
      await usersTab.first().click();
    }
    await expect(page.getByLabel("Search table").first()).toBeVisible({ timeout: 20_000 });
  });

  test("portal kb uses DataTable search", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);
    await page.goto("/portal/kb");
    await expect(page.getByRole("heading", { name: /Knowledge base/i })).toBeVisible();
    await expect(page.getByLabel("Search table")).toBeVisible();
  });
});
