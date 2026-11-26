import { api } from "@/lib/api";

export type AssistantTool = {
  name: string;
  description: string;
  writes: boolean;
};

export type AssistantStatus = {
  enabled: boolean;
  tools: AssistantTool[];
};

export type AssistantPendingAction = {
  id: number;
  tool: string;
  summary: string;
  expires_at: string;
};

export type AssistantReply = {
  id: string;
  text: string;
};

export type AssistantMessageResult = {
  replies: AssistantReply[];
  pending_actions: AssistantPendingAction[];
};

export type AssistantConversation = {
  id: string;
  expires_at: string;
};

const BASE = "/api/v1/org/assistant";

export async function fetchAssistantStatus(tenant: string): Promise<AssistantStatus> {
  const res = await api<{ data: AssistantStatus }>(`${BASE}/status`, { tenant });
  return res.data;
}

export async function startAssistantConversation(tenant: string): Promise<AssistantConversation> {
  const res = await api<{ data: AssistantConversation }>(`${BASE}/conversations`, {
    tenant,
    method: "POST",
  });
  return res.data;
}

export async function sendAssistantMessage(
  tenant: string,
  conversationId: string,
  message: string,
): Promise<AssistantMessageResult> {
  const res = await api<{ data: AssistantMessageResult }>(
    `${BASE}/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      tenant,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
  );
  return res.data;
}

/** Confirming runs the proposed write. Only the signed-in user's session can do this; the agent cannot. */
export async function confirmAssistantAction(tenant: string, pendingActionId: number): Promise<void> {
  await api(`${BASE}/pending-actions/${pendingActionId}/confirm`, {
    tenant,
    method: "POST",
  });
}

export async function cancelAssistantAction(tenant: string, pendingActionId: number): Promise<void> {
  await api(`${BASE}/pending-actions/${pendingActionId}/cancel`, {
    tenant,
    method: "POST",
  });
}
