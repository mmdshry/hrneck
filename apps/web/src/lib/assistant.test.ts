import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  cancelAssistantAction,
  confirmAssistantAction,
  fetchAssistantStatus,
  sendAssistantMessage,
  startAssistantConversation,
} from "./assistant";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}));

const apiMock = vi.mocked(api);

describe("assistant api client", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("loads status for the active tenant", async () => {
    apiMock.mockResolvedValueOnce({ data: { enabled: true, tools: [] } });

    await expect(fetchAssistantStatus("itneck")).resolves.toEqual({ enabled: true, tools: [] });
    expect(apiMock).toHaveBeenCalledWith("/api/v1/org/assistant/status", { tenant: "itneck" });
  });

  it("starts a conversation with POST and returns its id", async () => {
    apiMock.mockResolvedValueOnce({ data: { id: "conv-1", expires_at: "2026-11-24T10:00:00Z" } });

    await expect(startAssistantConversation("itneck")).resolves.toEqual({
      id: "conv-1",
      expires_at: "2026-11-24T10:00:00Z",
    });
    expect(apiMock).toHaveBeenCalledWith("/api/v1/org/assistant/conversations", {
      tenant: "itneck",
      method: "POST",
    });
  });

  it("sends the message as JSON to the conversation", async () => {
    apiMock.mockResolvedValueOnce({ data: { replies: [], pending_actions: [] } });

    await sendAssistantMessage("itneck", "conv-1", "Show my tickets");

    expect(apiMock).toHaveBeenCalledWith(
      "/api/v1/org/assistant/conversations/conv-1/messages",
      expect.objectContaining({
        tenant: "itneck",
        method: "POST",
        body: JSON.stringify({ message: "Show my tickets" }),
      }),
    );
  });

  it("confirms and cancels pending actions by id on the session routes", async () => {
    apiMock.mockResolvedValue({});

    await confirmAssistantAction("itneck", 7);
    await cancelAssistantAction("itneck", 8);

    expect(apiMock).toHaveBeenNthCalledWith(1, "/api/v1/org/assistant/pending-actions/7/confirm", {
      tenant: "itneck",
      method: "POST",
    });
    expect(apiMock).toHaveBeenNthCalledWith(2, "/api/v1/org/assistant/pending-actions/8/cancel", {
      tenant: "itneck",
      method: "POST",
    });
  });
});
