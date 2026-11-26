import { test, expect } from "@playwright/test";
import { ORG_STORAGE_STATE } from "./helpers/auth";

test.use({ storageState: ORG_STORAGE_STATE });

test.describe("Ticketing", () => {
  test("org ticketing queue and desks render", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/org/ticketing");
    await expect(page.getByRole("heading", { name: "Ticketing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New ticket" })).toBeVisible();

    await page.goto("/org/ticketing/desks");
    await expect(
      page.getByRole("heading", { name: "Desks", exact: true }).or(page.getByText("Desks", { exact: true }).first()),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto("/org/kb");
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
    await page.goto("/org/ticketing");
    await page.getByRole("button", { name: "New ticket" }).click();
    const dialog = page.getByRole("dialog", { name: "New ticket" });
    await expect(dialog.locator("#new-ticket-desk option").first()).toBeAttached({ timeout: 20_000 });
    await expect(dialog.locator("#new-ticket-desk")).not.toHaveValue("", { timeout: 20_000 });
    const summary = `E2E ticket ${Date.now()}`;
    await dialog.locator("#new-ticket-summary").fill(summary);
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/org/ticketing/tickets") &&
        res.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Create ticket" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    await expect(page).toHaveURL(/\/org\/ticketing\/tickets\/\d+/, { timeout: 30_000 });
    // Exact match: the page header subtitle also contains the summary ("<summary> · <status>").
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
  });
});
