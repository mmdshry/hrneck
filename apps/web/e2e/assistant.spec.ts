import { expect, test } from "@playwright/test";
import { ORG_STORAGE_STATE } from "./helpers/auth";

test.use({ storageState: ORG_STORAGE_STATE });

/**
 * Smoke test for the chat panel. The assistant endpoints are mocked, so this does not need Copilot Studio
 * secrets. It checks the UI path: open the chat, send a message, confirm a proposed write.
 */
test.describe("Assistant chat", () => {
  test("opens the chat, sends a message and confirms a proposed ticket", async ({ page }) => {
    test.setTimeout(90_000);
    let confirmed = false;
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

    await page.route("**/api/v1/org/assistant/status", (route) =>
      route.fulfill({
        json: {
          data: {
            enabled: true,
            tools: [{ name: "ticket_create", description: "Create a ticket", writes: true }],
          },
        },
      }),
    );
    await page.route("**/api/v1/org/assistant/conversations", (route) =>
      route.fulfill({
        status: 201,
        json: { data: { id: "e2e-conversation", expires_at: expiresAt } },
      }),
    );
    await page.route("**/api/v1/org/assistant/conversations/e2e-conversation/messages", (route) =>
      route.fulfill({
        json: {
          data: {
            replies: [{ id: "r1", text: "I can open that ticket for you." }],
            pending_actions: confirmed
              ? []
              : [
                  {
                    id: 99,
                    tool: "ticket_create",
                    summary: 'Create a ticket in "Incident" titled "E2E VPN".',
                    expires_at: expiresAt,
                  },
                ],
          },
        },
      }),
    );
    await page.route("**/api/v1/org/assistant/pending-actions/99/confirm", (route) => {
      confirmed = true;
      return route.fulfill({ json: { status: "confirmed", data: { number: "INC-1" } } });
    });

    await page.goto("/org");
    await page.getByRole("button", { name: "Open assistant", exact: true }).click();

    await page.getByRole("textbox", { name: "Type your message…", exact: true }).fill("Open a ticket for my VPN");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("I can open that ticket for you.")).toBeVisible();

    const card = page.getByRole("group", { name: "Waiting for your confirmation", exact: true });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect(card).toBeHidden();
    expect(confirmed).toBe(true);
  });
});
