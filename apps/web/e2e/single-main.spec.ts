import { expect, test } from "@playwright/test";

test("client navigation keeps a single main landmark", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@hrneck.test");
  await page.getByLabel("Password").fill("DemoPass!234");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/msp/, { timeout: 30_000 });

  await page.getByRole("link", { name: "Open tenant admin" }).first().click();
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
