import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

/** Session cookies written by e2e/auth.setup.ts. Git-ignored: they are live credentials. */
export const ORG_STORAGE_STATE = path.join(__dirname, "..", ".auth", "org.json");
export const PLATFORM_STORAGE_STATE = path.join(__dirname, "..", ".auth", "platform.json");

export async function saveStorageState(page: Page, file: string): Promise<void> {
  mkdirSync(path.dirname(file), { recursive: true });
  await page.context().storageState({ path: file });
}

export async function loginAs(
  page: Page,
  email: string,
  password = "DemoPass!234",
): Promise<void> {
  await page.goto("/login");
  const emailInput = page.getByLabel("Email");
  const passwordInput = page.getByLabel("Password");
  await emailInput.fill("");
  await emailInput.pressSequentially(email, { delay: 15 });
  await passwordInput.fill("");
  await passwordInput.pressSequentially(password, { delay: 15 });
  await expect(emailInput).toHaveValue(email);
  // Exact match: the login page also has "Continue with Google/Microsoft" buttons.
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

export async function loginAsOrgAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin@itneck.test");
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/login") && /\/org(?:\/|$)/.test(url.pathname),
    { timeout: 20_000 },
  );
}

export async function loginAsPlatformAdmin(page: Page): Promise<void> {
  await loginAs(page, "admin@hrneck.test");
  await page.waitForURL(/\/msp(?:\/|$)/, { timeout: 20_000 });
}

/** Desktop keeps the sidebar open; mobile needs the hamburger drawer. */
export async function openOrgNavIfNeeded(page: Page): Promise<void> {
  const openNav = page.getByRole("button", { name: /open navigation menu/i });
  if (await openNav.isVisible()) {
    await openNav.click();
    await expect(page.locator("#org-mobile-nav")).toBeVisible();
  }
}

/** Prefer the visible control; desktop sidebar stays in the DOM while inert on mobile. */
export function visibleRole(
  page: Page,
  role: Parameters<Page["getByRole"]>[0],
  name: string | RegExp,
) {
  return page.getByRole(role, { name }).filter({ visible: true });
}

/** Prefer the visible control — desktop sidebar and mobile drawer both mount Sign out. */
export async function signOutFromOrgShell(page: Page): Promise<void> {
  const openNav = page.getByRole("button", { name: /open navigation menu/i });
  // Shell auth footer hydrates after /org; wait for either mobile menu or desktop Sign out.
  await expect
    .poll(async () => {
      if (await openNav.isVisible().catch(() => false)) return "mobile";
      if (
        await page
          .getByRole("button", { name: /sign out/i })
          .locator("visible=true")
          .count()
      ) {
        return "desktop";
      }
      return "";
    }, { timeout: 20_000 })
    .not.toBe("");

  if (await openNav.isVisible()) {
    await openNav.click();
    const signOut = page.locator("#org-mobile-nav").getByRole("button", { name: /sign out/i });
    await expect(signOut).toBeAttached({ timeout: 15_000 });
    await signOut.scrollIntoViewIfNeeded();
    await expect(signOut).toBeVisible({ timeout: 15_000 });
    await signOut.click();
    return;
  }

  await page.getByRole("button", { name: /sign out/i }).locator("visible=true").first().click();
}
