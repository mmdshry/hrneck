import { test, expect } from "@playwright/test";
import { ORG_STORAGE_STATE, TENANT_ORIGIN } from "./helpers/auth";

test.use({ baseURL: TENANT_ORIGIN, storageState: ORG_STORAGE_STATE });

test.describe("Ticketing advanced flows", () => {
  test("bulk archive, convert to KB, and portal submit", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/org/ticketing");
    await expect(page.getByRole("heading", { name: "Ticketing" })).toBeVisible();

    const summary = `E2E advanced ${Date.now()}`;
    await page.getByRole("button", { name: "New ticket" }).click();
    const newTicketDialog = page.getByRole("dialog", { name: "New ticket" });
    await expect(newTicketDialog.locator("#new-ticket-desk")).not.toHaveValue("", { timeout: 20_000 });
    await newTicketDialog.locator("#new-ticket-summary").fill(summary);
    const [created] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/v1/org/ticketing/tickets") &&
          res.request().method() === "POST",
      ),
      newTicketDialog.getByRole("button", { name: "Create ticket" }).click(),
    ]);
    expect(created.status()).toBe(201);
    await expect(page).toHaveURL(/\/org\/ticketing\/tickets\/\d+/, { timeout: 30_000 });
    const ticketUrl = page.url();

    await page.goto("/org/ticketing");
    await expect(page.getByText(summary).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("checkbox", { name: /Select ticket/i }).first().check();
    const bulkPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/org/ticketing/tickets/bulk") &&
        res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    const bulk = await bulkPromise;
    expect(bulk.ok()).toBeTruthy();

    await page.goto(ticketUrl);
    await page.getByRole("button", { name: "Convert to KB" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Convert to KB" }).click();
    await expect(page.getByText(/converted|knowledge|kb/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/portal/tickets");
    await expect(page.getByRole("heading", { name: "My tickets" })).toBeVisible();
    await page.getByRole("button", { name: "New request" }).click({ timeout: 20_000 });
    const requestDialog = page.getByRole("dialog", { name: "New request" });
    await expect(requestDialog.locator("#portal-desk")).not.toHaveValue("", { timeout: 20_000 });
    const portalSummary = `Portal E2E ${Date.now()}`;
    await requestDialog.getByRole("button", { name: "Next" }).click();
    await requestDialog.locator("#portal-summary").fill(portalSummary);
    await requestDialog.getByRole("button", { name: "Next" }).click();
    await requestDialog.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page).toHaveURL(/\/portal\/tickets\/\d+/, { timeout: 30_000 });
  });
});



