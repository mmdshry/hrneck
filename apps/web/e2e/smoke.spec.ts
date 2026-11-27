import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { TENANT_ORIGIN } from "./helpers/auth";

// login-form.tsx prefills the demo email only under `next dev`; the production build starts empty.
// The prefill is on the organization sign-in form (the main site has none).
const expectedDemoEmail = process.env.PLAYWRIGHT_DEV_SERVER === "1" ? "admin@itneck.test" : "";

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
  "/portal",
] as const;

test.describe("HRneck smoke", () => {
  test("home is accessible and branded", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Security awareness training for MSPs and every client organization.",
    );
    await expect(page.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await skipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("login page has no skip link", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toHaveCount(0);
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

  test("login page demo prefill matches the build mode", async ({ page }) => {
    await page.goto(new URL("/login", TENANT_ORIGIN).toString());
    await expect(page.getByLabel("Email")).toHaveValue(expectedDemoEmail);
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

  test("training and portal pages have no Refresh buttons", async ({ page }) => {
    await page.goto("/org/training");
    await expect(page.getByRole("button", { name: /^Refresh$/i })).toHaveCount(0);
    await page.goto("/org/courses");
    await expect(page.getByRole("button", { name: /^Refresh$/i })).toHaveCount(0);
    await page.goto("/portal");
    await expect(
      page.getByRole("button", { name: /Refresh assignments/i }),
    ).toHaveCount(0);
  });
});

