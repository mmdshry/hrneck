"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import type { SdDesk, SdTicket } from "../../ticketing-types";

export function TicketDetailClient({ ticketId }: { ticketId: number }) {
  const [ticket, setTicket] = useState<SdTicket | null>(null);
  const [desk, setDesk] = useState<SdDesk | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteIsPublic, setNoteIsPublic] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [tab, setTab] = useState<"details" | "notes" | "tasks" | "related">("details");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    await ensureCsrf();
    const tenant = resolveTenant();
    const res = await api<{ data: SdTicket }>(`/api/v1/org/ticketing/tickets/${ticketId}`, { tenant });
    setTicket(res.data);
    if (res.data.desk_id) {
      const d = await api<{ data: SdDesk }>(`/api/v1/org/ticketing/desks/${res.data.desk_id}`, { tenant });
      setDesk(d.data);
    }
  }

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [ticketId]);

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    if (!ticket) return;
    setMessage(null);
    try {
      await ensureCsrf();
      const updated = await api<{ data: SdTicket }>(`/api/v1/org/ticketing/tickets/${ticketId}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: ticket.summary,
          description: ticket.description,
          stage_id: ticket.stage_id,
          status_id: ticket.status_id,
          priority_id: ticket.priority_id,
          assignee_pool: ticket.assignee_pool,
        }),
      });
      setTicket(updated.data);
      setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      await api(`/api/v1/org/ticketing/tickets/${ticketId}/notes`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note, is_public: noteIsPublic }),
      });
      setNote("");
      setNoteIsPublic(false);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Note failed");
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      await api(`/api/v1/org/ticketing/tickets/${ticketId}/tasks`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle }),
      });
      setTaskTitle("");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Task failed");
    }
  }

  async function convertKb() {
    try {
      await ensureCsrf();
      const res = await api<{ data: { id: number } }>(`/api/v1/org/ticketing/tickets/${ticketId}/convert-kb`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: true }),
      });
      setMessage(`KB article #${res.data.id} created.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Convert failed");
    }
  }

  if (loading) {
    return <PageSkeleton className="max-w-5xl" variant="detail" />;
  }

  if (!ticket) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader title="Ticket" description="Could not load this ticket." />
        {message ? <Alert>{message}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        title={ticket.number}
        description={ticket.summary}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/ticketing" variant="outline">
              Back to queue
            </LinkButton>
            <Button type="button" variant="outline" onClick={() => void convertKb()}>
              Convert to KB
            </Button>
          </div>
        }
      />
      {message ? <Alert>{message}</Alert> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ticket sections">
        {(["details", "notes", "tasks", "related"] as const).map((t) => (
          <Button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>

      {tab === "details" ? (
        <Panel title="Details">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={saveDetails}>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="ticket-summary">Summary</Label>
              <Input
                id="ticket-summary"
                value={ticket.summary}
                onChange={(e) => setTicket({ ...ticket, summary: e.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="ticket-description">Description</Label>
              <Textarea
                id="ticket-description"
                rows={5}
                value={ticket.description ?? ""}
                onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ticket-stage">Stage</Label>
              <Select
                id="ticket-stage"
                value={String(ticket.stage_id ?? "")}
                onChange={(e) => setTicket({ ...ticket, stage_id: Number(e.target.value) })}
              >
                {(desk?.stages ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select
                id="ticket-priority"
                value={String(ticket.priority_id ?? "")}
                onChange={(e) => setTicket({ ...ticket, priority_id: Number(e.target.value) })}
              >
                {(desk?.priorities ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ticket-status">Status</Label>
              <Select
                id="ticket-status"
                value={String(ticket.status_id ?? "")}
                onChange={(e) => setTicket({ ...ticket, status_id: Number(e.target.value) })}
              >
                {(desk?.statuses ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ticket-assignee-pool">Assignee pool</Label>
              <Input
                id="ticket-assignee-pool"
                value={ticket.assignee_pool ?? ""}
                onChange={(e) => setTicket({ ...ticket, assignee_pool: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 text-sm text-[var(--muted-foreground)]">
              Escalation level: {ticket.escalation_level ?? 0}
              {ticket.sla_response_breached || ticket.sla_resolve_breached ? " · SLA breach" : ""}
            </div>
            <div>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Panel>
      ) : null}

      {tab === "notes" ? (
        <Panel title="Notes">
          <ul className="mb-4 space-y-3">
            {(ticket.notes ?? []).map((n) => (
              <li key={n.id} className="rounded border border-[var(--border)] p-3 text-sm">
                <div className="text-[var(--muted-foreground)]">{n.is_public ? "Public" : "Private"} · {n.created_at}</div>
                <div className="whitespace-pre-wrap">{n.body}</div>
              </li>
            ))}
          </ul>
          <form className="space-y-2" onSubmit={addNote}>
            <Label htmlFor="ticket-note-body">Note</Label>
            <Textarea
              id="ticket-note-body"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
            />
            <label htmlFor="ticket-note-public" className="flex items-center gap-2 text-sm">
              <input
                id="ticket-note-public"
                type="checkbox"
                checked={noteIsPublic}
                onChange={(e) => setNoteIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border border-[var(--border)]"
              />
              Visible in portal (public)
            </label>
            <Button type="submit">Add note</Button>
          </form>
        </Panel>
      ) : null}

      {tab === "tasks" ? (
        <Panel title="Tasks">
          <ul className="mb-4 space-y-2">
            {(ticket.tasks ?? []).map((t) => (
              <li key={t.id} className="text-sm">
                {t.is_completed ? "✓" : "○"} {t.title} ({t.hours_worked ?? 0}h)
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={addTask}>
            <Label htmlFor="ticket-task-title" className="sr-only">
              Task title
            </Label>
            <Input
              id="ticket-task-title"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Task title"
              aria-label="Task title"
              required
            />
            <Button type="submit">Add</Button>
          </form>
        </Panel>
      ) : null}

      {tab === "related" ? (
        <Panel title="Related">
          <ul className="space-y-2 text-sm">
            {(ticket.links ?? []).map((l) => (
              <li key={l.id}>
                {l.link_type}: {l.related_type} #{l.related_id}
              </li>
            ))}
            {(ticket.links ?? []).length === 0 ? <li className="text-[var(--muted-foreground)]">No links.</li> : null}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
