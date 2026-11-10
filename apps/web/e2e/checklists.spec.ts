import { test, expect } from "@playwright/test";
import { loginAsOrgAdmin } from "./helpers/auth";

test.describe("Checklists UI", () => {
  test("packs and templates happy path", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);

    await page.goto("/org/checklists");
    await expect(page.getByRole("heading", { name: "Checklists" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/onboarding|offboarding|template/i).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/org/checklists/packs");
    await expect(page.getByRole("heading", { name: "Checklist packs" })).toBeVisible({
      timeout: 20_000,
    });
    const packLink = page.getByRole("link").filter({ hasText: /welcome|pack|onboard/i }).first();
    if (await packLink.count()) {
      await packLink.click();
      await expect(page.getByRole("heading").first()).toBeVisible();
    }

    await page.goto("/org/checklists/instances");
    await expect(page.getByRole("heading", { name: "Checklist instances" })).toBeVisible();
  });
});
