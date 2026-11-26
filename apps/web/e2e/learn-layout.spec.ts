import { expect, test } from "@playwright/test";
import { ORG_STORAGE_STATE } from "./helpers/auth";

test.use({
  storageState: ORG_STORAGE_STATE,
  viewport: { width: 390, height: 844 },
});

test.describe("Employee dashboard layout", () => {
  test("renders in the portal shell without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/portal");
    // Name-scoped: a loading skeleton can also render an h1 while the dashboard loads.
    await expect(page.getByRole("heading", { level: 1, name: "My dashboard" })).toBeVisible();
    await expect(page.locator("#main-content")).toHaveCount(1);

    const overflowPx = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflowPx).toBeLessThanOrEqual(1);
  });

  test("opens the mobile navigation and closes it with Escape", async ({
    page,
  }) => {
    await page.goto("/portal");
    const toggle = page.getByRole("button", { name: /open navigation menu/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const menu = page.locator("#org-mobile-nav");
    await expect(menu.getByRole("link", { name: /my courses/i })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
  });
});
