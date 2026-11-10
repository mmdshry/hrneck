import { test, expect } from "@playwright/test";

test.describe("Password reset UI", () => {
  test("forgot password form shows generic success message", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/login/forgot");
    await expect(page.getByRole("heading", { name: "Forgot password" })).toBeVisible();
    await page.getByLabel("Email").fill("admin@itneck.test");
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/v1/auth/password/forgot") &&
        res.request().method() === "POST",
    );
    await page.getByRole("button", { name: /send reset link/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(
      page.getByText(/if that email is registered, a reset link has been sent/i),
    ).toBeVisible();
  });

  test("reset password form stays disabled without a token", async ({ page }) => {
    await page.goto("/login/reset?email=admin%40itneck.test");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
    await page.getByLabel("New password").fill("NewPass!23456");
    await page.getByLabel("Confirm password").fill("NewPass!23456");
    await expect(page.getByRole("button", { name: "Reset password" })).toBeDisabled();
  });
});

