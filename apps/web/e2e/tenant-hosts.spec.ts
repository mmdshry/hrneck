import { test, expect } from "@playwright/test";

test.describe("tenant host shells", () => {
  test("itneck org shell requires sign in", async ({ page }) => {
    await page.goto("/org");
    await expect(page).toHaveURL(/\/login/);
  });

  test("learner portal renders sample course", async ({ page }) => {
    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
