import { test, expect } from "@playwright/test";
import path from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { ORG_STORAGE_STATE, TENANT_ORIGIN } from "./helpers/auth";

test.use({ baseURL: TENANT_ORIGIN, storageState: ORG_STORAGE_STATE });

test.describe("Targets CSV import", () => {
  test("wizard import creates employees from non-canonical headers", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/org/targets");
    await expect(page.getByRole("heading", { name: /employees|targets/i }).first()).toBeVisible();

    const dir = mkdtempSync(path.join(tmpdir(), "hrneck-csv-"));
    const email = `e2e.import.${Date.now()}@itneck.test`;
    const csvPath = path.join(dir, "targets.csv");
    writeFileSync(
      csvPath,
      `Email Address,First Name,Last Name,Dept\n${email},E2E,Import,Security\n`,
      "utf8",
    );

    await page.getByRole("button", { name: "Import employees" }).click();
    await expect(page.getByRole("heading", { name: /import employees/i })).toBeVisible();

    await page.locator("#employee-import-csv").setInputFiles(csvPath);

    const sessionPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/org/targets/import/sessions") &&
        res.request().method() === "POST" &&
        !res.url().includes("/preview") &&
        !res.url().includes("/commit"),
    );
    await page.getByRole("button", { name: "Continue" }).click();
    expect((await sessionPromise).ok()).toBeTruthy();

    await expect(page.getByRole("heading", { name: /map columns/i })).toBeVisible();
    await expect(page.locator("#map-email")).toHaveValue("Email Address");

    const previewPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/preview") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Preview" }).click();
    expect((await previewPromise).ok()).toBeTruthy();

    await expect(page.getByRole("heading", { name: /preview import/i })).toBeVisible();

    const commitPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/commit") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Import", exact: true }).click();
    expect((await commitPromise).ok()).toBeTruthy();

    await expect(page.getByRole("heading", { name: /import results/i })).toBeVisible();
    await page.getByText("Close", { exact: true }).click();
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 20_000 });
  });
});
