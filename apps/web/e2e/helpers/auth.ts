import { expect, type Page } from "@playwright/test";

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
  await page.getByRole("button", { name: /continue/i }).click();
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
