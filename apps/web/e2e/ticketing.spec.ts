import { test, expect } from "@playwright/test";

async function loginAsOrgAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@itneck.test");
  await page.getByLabel("Password").fill("DemoPass!234");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/(org|msp|learn)/, { timeout: 30_000 });
}

test.describe("Ticketing", () => {
  test("org ticketing queue and desks render", async ({ page }) => {
    await loginAsOrgAdmin(page);
    await page.goto("/org/ticketing");
    await expect(page.getByRole("heading", { name: "Ticketing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create ticket" })).toBeVisible();

    await page.goto("/org/ticketing/desks");
    await expect(page.getByRole("heading", { name: "Desks", exact: true })).toBeVisible();

    await page.goto("/org/ticketing/kb");
    await expect(page.getByRole("heading", { name: "Knowledge Base" })).toBeVisible();

    await page.goto("/org/ticketing/reports");
    await expect(page.getByRole("heading", { name: "Ticketing reports" })).toBeVisible();

    await page.goto("/portal/tickets");
    await expect(page.getByRole("heading", { name: "My tickets" })).toBeVisible();

    await page.goto("/portal/kb");
    await expect(page.getByRole("heading", { name: "Knowledge base" })).toBeVisible();
  });

  test("create ticket from queue when authenticated shell works", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsOrgAdmin(page);
    await page.goto("/org/ticketing");
    await expect(page.getByLabel("Desk", { exact: true })).toContainText("Incident Desk");
    const summary = `E2E ticket ${Date.now()}`;
    await page.getByLabel("Summary").fill(summary);
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/org/ticketing/tickets") &&
        res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create ticket" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    await expect(page).toHaveURL(/\/org\/ticketing\/tickets\/\d+/, { timeout: 30_000 });
    await expect(page.getByText(summary)).toBeVisible();
  });
});
