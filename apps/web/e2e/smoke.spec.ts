import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const AXE_ROUTES = [
  "/",
  "/login",
  "/docs",
  "/docs/getting-started",
  "/msp",
  "/org",
  "/org/settings",
  "/org/ticketing",
  "/org/checklists",
  "/portal/tickets",
  "/learn",
] as const;

test.describe("HRNECK smoke", () => {
  test("home is accessible and branded", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Training Portal",
    );
    await expect(page.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  for (const route of AXE_ROUTES) {
    test(`axe: ${route}`, async ({ page }) => {
      await page.goto(route);
      const authGated =
        route === "/msp" ||
        route === "/org" ||
        route.startsWith("/org/");
      if (authGated) {
        await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      }
      await expect(page.locator("#main-content")).toHaveCount(1);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("login page renders demo credentials fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toHaveValue("admin@hrneck.test");
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("msp and org shells require sign in", async ({ page }) => {
    await page.goto("/msp");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/org");
    await expect(page).toHaveURL(/\/login/);
  });

  test("settings requires sign in", async ({ page }) => {
    await page.goto("/org/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});

