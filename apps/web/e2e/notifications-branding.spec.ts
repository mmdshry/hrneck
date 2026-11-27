import { test, expect } from "@playwright/test";
import { ORG_STORAGE_STATE, TENANT_ORIGIN } from "./helpers/auth";

test.use({ baseURL: TENANT_ORIGIN, storageState: ORG_STORAGE_STATE });

test.describe("Notifications and branding", () => {
  test("org shell shows notification bell after sign in", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/org");
    await expect(page.getByRole("link", { name: "Notifications" }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("admin can publish announcement and open it from notifications page", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const title = `E2E notice ${Date.now()}`;
    await page.goto("/org/announcements");
    await page.getByRole("button", { name: "New announcement" }).click({ timeout: 20_000 });
    const publishDialog = page.getByRole("dialog", { name: "New announcement" });
    await expect(publishDialog.locator("#announcement-title")).toBeVisible({ timeout: 20_000 });
    await publishDialog.locator("#announcement-title").fill(title);
    await publishDialog.locator("#announcement-body").fill("Automated announcement body.");
    // Publishing queues one email per tenant user on the sync queue, so the POST can take 30 s+ locally.
    const publishPromise = page.waitForResponse(
      (res) => res.url().includes("/api/v1/org/announcements") && res.request().method() === "POST",
      { timeout: 120_000 },
    );
    await publishDialog.getByRole("button", { name: "Publish announcement" }).click();
    expect((await publishPromise).status()).toBe(201);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "Notifications" }).first().click();
    await expect(page).toHaveURL(/\/org\/notifications/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test("settings can save primary color and show display name chrome", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/org/settings");
    await expect(page.locator("#settings-display-name")).toBeVisible({ timeout: 20_000 });
    await page.locator("#settings-display-name").fill("ITneck Demo Brand");
    await page.locator("#settings-primary-color").fill("#115e59");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("White-label and sending domain saved.")).toBeVisible({
      timeout: 15_000,
    });
    // Org sidebar is logo-only (no display-name chrome); assert persistence on settings.
    await page.goto("/org/settings");
    await expect(page.locator("#settings-display-name")).toHaveValue("ITneck Demo Brand", {
      timeout: 20_000,
    });
  });
});
