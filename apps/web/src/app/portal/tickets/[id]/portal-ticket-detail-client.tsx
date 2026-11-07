"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";

type Ticket = {
  id: number;
  number: string;
  summary: string;
  description?: string | null;
  stage?: { name: string } | null;
  status?: { name: string } | null;
  notes?: Array<{ id: number; body: string; created_at?: string }>;
};

export function PortalTicketDetailClient({ ticketId }: { ticketId: number }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    await ensureCsrf();
    const res = await api<{ data: Ticket }>(`/api/v1/org/portal/ticketing/tickets/${ticketId}`, {
      tenant: resolveTenant(),
    });
    setTicket(res.data);
  }

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [ticketId]);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      await api(`/api/v1/org/portal/ticketing/tickets/${ticketId}/notes`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note }),
      });
      setNote("");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Note failed");
    }
  }

  if (loading) {
    return <PageSkeleton variant="detail" />;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <PageHeader title="Ticket" description="Could not load this ticket." />
        {message ? <Alert>{message}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.number}
        description={ticket.summary}
        actions={<LinkButton href="/portal/tickets" variant="outline">Back</LinkButton>}
      />
      {message ? <Alert>{message}</Alert> : null}
      <Panel title="Details">
        <p className="mb-2 text-sm text-[var(--muted-foreground)]">
          {ticket.stage?.name} / {ticket.status?.name}
        </p>
        <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
      </Panel>
      <Panel title="Conversation">
        <ul className="mb-4 space-y-3">
          {(ticket.notes ?? []).map((n) => (
            <li key={n.id} className="rounded border border-[var(--border)] p-3 text-sm whitespace-pre-wrap">
              {n.body}
            </li>
          ))}
        </ul>
        <form className="space-y-2" onSubmit={addNote}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required />
          <Button type="submit">Add note</Button>
        </form>
      </Panel>
    </div>
  );
}
