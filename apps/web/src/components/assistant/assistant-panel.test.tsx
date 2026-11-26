import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AssistantPanel } from "./assistant-panel";

const mocks = vi.hoisted(() => ({
  fetchAssistantStatus: vi.fn(),
  startAssistantConversation: vi.fn(),
  sendAssistantMessage: vi.fn(),
  confirmAssistantAction: vi.fn(),
  cancelAssistantAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/assistant", () => mocks);

const enabledStatus = {
  enabled: true,
  tools: [
    { name: "tickets_search", description: "Search tickets", writes: false },
    { name: "ticket_create", description: "Create a ticket", writes: true },
  ],
};

const pendingTicket = {
  id: 7,
  tool: "ticket_create",
  summary: 'Create a ticket in "Incident" titled "VPN down".',
  expires_at: "2026-11-24T10:00:00Z",
};

async function renderOpenPanel() {
  render(<AssistantPanel tenant="itneck" />);
  fireEvent.click(await screen.findByRole("button", { name: "open" }));
  return screen.getByRole("region", { name: "title" });
}

async function sendMessage(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "placeholder" }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "send" }));
}

describe("AssistantPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchAssistantStatus.mockResolvedValue(enabledStatus);
    mocks.startAssistantConversation.mockResolvedValue({
      id: "conv-1",
      expires_at: "2026-11-24T10:30:00Z",
    });
    mocks.sendAssistantMessage.mockResolvedValue({ replies: [], pending_actions: [] });
    mocks.confirmAssistantAction.mockResolvedValue(undefined);
    mocks.cancelAssistantAction.mockResolvedValue(undefined);
  });

  it("renders nothing when the tenant is outside the pilot", async () => {
    mocks.fetchAssistantStatus.mockResolvedValue({ enabled: false, tools: [] });

    const { container } = render(<AssistantPanel tenant="company" />);
    await act(async () => {});

    expect(mocks.fetchAssistantStatus).toHaveBeenCalledWith("company");
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when the status request fails", async () => {
    mocks.fetchAssistantStatus.mockRejectedValue(new Error("network"));

    const { container } = render(<AssistantPanel tenant="itneck" />);
    await act(async () => {});

    expect(container.innerHTML).toBe("");
  });

  it("greets the user from the launcher bubble before anything is sent", async () => {
    render(<AssistantPanel tenant="itneck" />);

    expect(await screen.findByText("greeting")).toBeTruthy();
    expect(mocks.startAssistantConversation).not.toHaveBeenCalled();
  });

  it("toggles thumbs feedback on a bot reply without calling the server", async () => {
    mocks.sendAssistantMessage.mockResolvedValue({
      replies: [{ id: "r1", text: "You have 2 open tickets." }],
      pending_actions: [],
    });
    await renderOpenPanel();
    await sendMessage("How many tickets do I have?");
    await screen.findByText("You have 2 open tickets.");

    // The first thumbs-up belongs to the greeting, the second to the reply.
    const helpful = screen.getAllByRole("button", { name: "feedbackHelpful" })[1];
    expect(helpful.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(helpful);
    expect(helpful.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(helpful);
    expect(helpful.getAttribute("aria-pressed")).toBe("false");
  });

  it("starts one conversation and shows the bot reply", async () => {
    mocks.sendAssistantMessage.mockResolvedValue({
      replies: [{ id: "r1", text: "You have 2 open tickets." }],
      pending_actions: [],
    });
    await renderOpenPanel();

    await sendMessage("How many tickets do I have?");

    expect(await screen.findByText("You have 2 open tickets.")).toBeTruthy();
    expect(screen.getByText("How many tickets do I have?")).toBeTruthy();
    expect(mocks.startAssistantConversation).toHaveBeenCalledTimes(1);
    expect(mocks.sendAssistantMessage).toHaveBeenCalledWith(
      "itneck",
      "conv-1",
      "How many tickets do I have?",
    );
  });

  it("shows a pending write as a card that waits for confirmation", async () => {
    mocks.sendAssistantMessage.mockResolvedValue({
      replies: [{ id: "r1", text: "I can create that. Please confirm." }],
      pending_actions: [pendingTicket],
    });
    await renderOpenPanel();

    await sendMessage("Open a ticket for my VPN");

    const card = await screen.findByRole("group", { name: "pendingTitle" });
    expect(within(card).getByText(pendingTicket.summary)).toBeTruthy();
    expect(mocks.confirmAssistantAction).not.toHaveBeenCalled();
  });

  it("confirms a pending write and removes its card", async () => {
    mocks.sendAssistantMessage.mockResolvedValue({ replies: [], pending_actions: [pendingTicket] });
    await renderOpenPanel();
    await sendMessage("Open a ticket for my VPN");

    const card = await screen.findByRole("group", { name: "pendingTitle" });
    fireEvent.click(within(card).getByRole("button", { name: "confirm" }));

    await waitFor(() => expect(mocks.confirmAssistantAction).toHaveBeenCalledWith("itneck", 7));
    await waitFor(() => expect(screen.queryByRole("group", { name: "pendingTitle" })).toBeNull());
    expect(await screen.findByText("confirmed")).toBeTruthy();
  });

  it("cancels a pending write without calling confirm", async () => {
    mocks.sendAssistantMessage.mockResolvedValue({ replies: [], pending_actions: [pendingTicket] });
    await renderOpenPanel();
    await sendMessage("Open a ticket for my VPN");

    const card = await screen.findByRole("group", { name: "pendingTitle" });
    fireEvent.click(within(card).getByRole("button", { name: "cancel" }));

    await waitFor(() => expect(mocks.cancelAssistantAction).toHaveBeenCalledWith("itneck", 7));
    expect(mocks.confirmAssistantAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("group", { name: "pendingTitle" })).toBeNull());
  });

  it("drops a card the server has already settled and explains why", async () => {
    mocks.sendAssistantMessage.mockResolvedValue({ replies: [], pending_actions: [pendingTicket] });
    mocks.confirmAssistantAction.mockRejectedValue(
      new ApiError(409, JSON.stringify({ message: "This action was already resolved." })),
    );
    await renderOpenPanel();
    await sendMessage("Open a ticket for my VPN");

    const card = await screen.findByRole("group", { name: "pendingTitle" });
    fireEvent.click(within(card).getByRole("button", { name: "confirm" }));

    expect((await screen.findByRole("alert")).textContent).toContain("resolvedElsewhere");
    await waitFor(() => expect(screen.queryByRole("group", { name: "pendingTitle" })).toBeNull());
  });

  it("starts a new conversation after the server ends the old one", async () => {
    mocks.startAssistantConversation
      .mockResolvedValueOnce({ id: "conv-1", expires_at: "2026-11-24T10:30:00Z" })
      .mockResolvedValueOnce({ id: "conv-2", expires_at: "2026-11-24T11:30:00Z" });
    mocks.sendAssistantMessage
      .mockRejectedValueOnce(new ApiError(409, JSON.stringify({ message: "ended" })))
      .mockResolvedValueOnce({
        replies: [{ id: "r2", text: "Hello again." }],
        pending_actions: [],
      });
    await renderOpenPanel();

    await sendMessage("First try");
    expect((await screen.findByRole("alert")).textContent).toContain("conversationEnded");

    await sendMessage("Second try");
    expect(await screen.findByText("Hello again.")).toBeTruthy();
    expect(mocks.startAssistantConversation).toHaveBeenCalledTimes(2);
    expect(mocks.sendAssistantMessage).toHaveBeenLastCalledWith("itneck", "conv-2", "Second try");
  });
});
