import { test, expect } from "@playwright/test";
import path from "node:path";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { loginAsOrgAdmin } from "./helpers/auth";

test.describe("Targets CSV import", () => {
  test("upload CSV creates or updates employees", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsOrgAdmin(page);
    await page.goto("/org/targets");
    await expect(page.getByRole("heading", { name: /employees|targets/i }).first()).toBeVisible();

    const dir = mkdtempSync(path.join(tmpdir(), "hrneck-csv-"));
    const email = `e2e.import.${Date.now()}@itneck.test`;
    const csvPath = path.join(dir, "targets.csv");
    writeFileSync(
      csvPath,
      `email,first_name,last_name,department\n${email},E2E,Import,Security\n`,
      "utf8",
    );

    await page.locator("#targets-csv").setInputFiles(csvPath);
    const uploadPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/org/targets/import") &&
        res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Upload CSV" }).click();
    const upload = await uploadPromise;
    expect(upload.ok()).toBeTruthy();
    await expect(page.getByText(email).first()).toBeVisible({ timeout: 20_000 });
  });
});
