import { test, expect } from "@playwright/test";

async function loginAsOrgAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");
  await expect(email).toHaveValue(/@/);
  await email.click();
  await email.fill("");
  await email.pressSequentially("admin@itneck.test", { delay: 15 });
  await password.click();
  await password.fill("");
  await password.pressSequentially("DemoPass!234", { delay: 15 });
  await expect(email).toHaveValue("admin@itneck.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/login") && /\/org(?:\/|$)/.test(url.pathname),
    { timeout: 30_000 },
  );
  await expect(page.getByRole("link", { name: "Notifications" }).first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Notifications and branding", () => {
  test("org shell shows notification bell after sign in", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsOrgAdmin(page);
  });

  test("admin can publish announcement and open it from notifications page", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);
    const title = `E2E notice ${Date.now()}`;
    await page.goto("/org/announcements");
    await expect(page.locator("#announcement-title")).toBeVisible({ timeout: 20_000 });
    await page.locator("#announcement-title").fill(title);
    await page.locator("#announcement-body").fill("Automated announcement body.");
    await page.getByRole("button", { name: "Publish announcement" }).click();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "Notifications" }).first().click();
    await expect(page).toHaveURL(/\/org\/notifications/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("settings can save primary color and show display name chrome", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);
    await page.goto("/org/settings");
    await expect(page.locator("#settings-display-name")).toBeVisible({ timeout: 20_000 });
    await page.locator("#settings-display-name").fill("ITneck Demo Brand");
    await page.locator("#settings-primary-color").fill("#115e59");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("White-label and sending domain saved.")).toBeVisible({
      timeout: 15_000,
    });
    await page.goto("/org");
    await expect(page.getByText("ITneck Demo Brand").filter({ visible: true }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
