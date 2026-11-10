"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { liveStatusLabel, useLiveTopic } from "@/hooks/use-live-topic";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { downloadAuthenticated } from "@/lib/download";
import { orgLiveChannel } from "@/lib/live-topics";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import type { SdDesk, SdTicket } from "../../ticketing-types";

type TicketsPayload = {
  data: SdTicket[];
};

type TicketNoteRow = {
  id: number;
  visibility: string;
  created_at: string;
  body: string;
};

type TicketTaskRow = {
  id: number;
  title: string;
  completion: string;
  hours: number;
  is_completed: boolean;
};

type TicketAttachment = NonNullable<SdTicket["attachments"]>[number];
type TicketLink = NonNullable<SdTicket["links"]>[number];

function taskHours(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function formatBytes(size: number | undefined): string {
  if (size == null || !Number.isFinite(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const noteColumns: Array<DataTableColumn<TicketNoteRow>> = [
  {
    id: "visibility",
    header: "Visibility",
    accessorKey: "visibility",
    filter: "select",
    filterOptions: [
      { label: "Public", value: "public" },
      { label: "Private", value: "private" },
    ],
    cell: (note) => (note.visibility === "public" ? "Public" : "Private"),
  },
  {
    id: "created_at",
    header: "Created",
    accessorKey: "created_at",
    cell: (note) => note.created_at || "—",
  },
  {
    id: "body",
    header: "Note",
    accessorKey: "body",
    className: "max-w-md whitespace-pre-wrap",
    cell: (note) => note.body,
  },
];

const linkColumns: Array<DataTableColumn<TicketLink>> = [
  {
    id: "link_type",
    header: "Link",
    accessorKey: "link_type",
    sticky: true,
    cell: (link) => link.link_type,
  },
  {
    id: "related_type",
    header: "Related type",
    accessorKey: "related_type",
    cell: (link) => link.related_type,
  },
  {
    id: "related_id",
    header: "Related id",
    accessorKey: "related_id",
    filterValue: (link) => link.related_id,
    cell: (link) => `#${link.related_id}`,
  },
];

export function TicketDetailClient({ ticketId }: { ticketId: number }) {
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "tickets") : null;
  const [ticket, setTicket] = useState<SdTicket | null>(null);
  const [desk, setDesk] = useState<SdDesk | null>(null);
  const [desks, setDesks] = useState<SdDesk[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteIsPublic, setNoteIsPublic] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [tab, setTab] = useState<"details" | "notes" | "tasks" | "attachments" | "related">(
    "details",
  );
  const [loading, setLoading] = useState(true);
  const [liveReady, setLiveReady] = useState(false);
  const [copyDeskId, setCopyDeskId] = useState("");
  const [copyLink, setCopyLink] = useState(true);
  const [copyIncludeNotes, setCopyIncludeNotes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);

  const refreshDetail = useCallback(async () => {
    await ensureCsrf();
    const t = resolveTenant();
    const res = await api<{ data: SdTicket }>(`/api/v1/org/ticketing/tickets/${ticketId}`, {
      tenant: t,
    });
    setTicket(res.data);
    if (res.data.desk_id) {
      const d = await api<{ data: SdDesk }>(`/api/v1/org/ticketing/desks/${res.data.desk_id}`, {
        tenant: t,
      });
      setDesk(d.data);
      setCopyDeskId((prev) => prev || String(res.data.desk_id));
    }
  }, [ticketId]);

  const onPayload = useCallback(
    (payload: TicketsPayload) => {
      setLiveReady(true);
      const items = Array.isArray(payload.data) ? payload.data : [];
      const match = items.find((row) => row.id === ticketId);
      if (match) {
        void refreshDetail().catch(() => {
          /* keep current detail */
        });
      }
    },
    [ticketId, refreshDetail],
  );

  const { status, error: liveError } = useLiveTopic<TicketsPayload>({
    channel,
    onPayload,
  });

  useEffect(() => {
    setLoading(true);
    void refreshDetail()
      .catch((err: unknown) => setMessage(err instanceof Error ? err.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [refreshDetail]);

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        setSession(me);
        const deskList = await api<{ data: SdDesk[] }>("/api/v1/org/ticketing/desks?per_page=100", {
          tenant: resolveTenant(),
        });
        setDesks((deskList.data ?? []).filter((d) => d.type !== "kb"));
      } catch {
        /* copy form can still use current desk */
      }
    })();
  }, []);

  const statusLabel = liveStatusLabel(status);
  const canConvertKb = hasPermission(session, "org.ticketing.kb");

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
      if (!liveReady) {
        await refreshDetail();
      }
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
      if (!liveReady) {
        await refreshDetail();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Task failed");
    }
  }

  async function toggleTaskComplete(taskId: number, isCompleted: boolean) {
    try {
      await ensureCsrf();
      await api(`/api/v1/org/ticketing/tickets/${ticketId}/tasks/${taskId}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: isCompleted }),
      });
      if (!liveReady) {
        await refreshDetail();
      } else {
        setTicket((prev) =>
          prev
            ? {
                ...prev,
                tasks: (prev.tasks ?? []).map((task) =>
                  task.id === taskId ? { ...task, is_completed: isCompleted } : task,
                ),
              }
            : prev,
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Task update failed");
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      await ensureCsrf();
      const body = new FormData();
      body.append("file", file);
      await api(`/api/v1/org/ticketing/tickets/${ticketId}/attachments`, {
        method: "POST",
        tenant: resolveTenant(),
        body,
      });
      form.reset();
      setMessage("Attachment uploaded.");
      await refreshDetail();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function downloadAttachment(attachment: TicketAttachment) {
    try {
      await downloadAuthenticated(
        `/api/v1/org/ticketing/tickets/${ticketId}/attachments/${attachment.id}`,
        attachment.original_name,
        attachment.mime || "*/*",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Download failed");
    }
  }

  async function copyTicket(event: FormEvent) {
    event.preventDefault();
    const deskId = Number(copyDeskId);
    if (!deskId) {
      setMessage("Select a desk for the copy.");
      return;
    }
    try {
      await ensureCsrf();
      const res = await api<{ data: SdTicket }>(`/api/v1/org/ticketing/tickets/${ticketId}/copy`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: deskId,
          link: copyLink,
          include_notes: copyIncludeNotes,
        }),
      });
      window.location.assign(`/org/ticketing/tickets/${res.data.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Copy failed");
    }
  }

  async function convertKb() {
    try {
      await ensureCsrf();
      const res = await api<{ data: { id: number } }>(
        `/api/v1/org/ticketing/tickets/${ticketId}/convert-kb`,
        {
          method: "POST",
          tenant: resolveTenant(),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publish: true }),
        },
      );
      setMessage(`KB article #${res.data.id} created.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Convert failed");
    }
  }

  const taskColumns: Array<DataTableColumn<TicketTaskRow>> = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      sticky: true,
      cell: (task) => task.title,
    },
    {
      id: "completion",
      header: "Status",
      accessorKey: "completion",
      filter: "select",
      filterOptions: [
        { label: "Done", value: "done" },
        { label: "Open", value: "open" },
      ],
      cell: (task) => (task.completion === "done" ? "Done" : "Open"),
    },
    {
      id: "hours",
      header: "Hours",
      accessorKey: "hours",
      filterValue: (task) => task.hours,
      cell: (task) => `${task.hours}h`,
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (task) => (
        <Button
          type="button"
          variant="outline"
          onClick={() => void toggleTaskComplete(task.id, !task.is_completed)}
        >
          {task.is_completed ? "Mark open" : "Mark done"}
        </Button>
      ),
    },
  ];

  const attachmentColumns: Array<DataTableColumn<TicketAttachment>> = [
    {
      id: "original_name",
      header: "File",
      accessorKey: "original_name",
      sticky: true,
      cell: (row) => row.original_name,
    },
    {
      id: "mime",
      header: "Type",
      accessorKey: "mime",
      cell: (row) => row.mime || "—",
    },
    {
      id: "size",
      header: "Size",
      filterValue: (row) => row.size ?? "",
      cell: (row) => formatBytes(row.size),
    },
    {
      id: "actions",
      header: "Actions",
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <Button type="button" variant="outline" onClick={() => void downloadAttachment(row)}>
          Download
        </Button>
      ),
    },
  ];

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
        description={
          statusLabel ? `${ticket.summary} · ${statusLabel}` : ticket.summary
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/org/ticketing" variant="outline">
              Back to queue
            </LinkButton>
            {canConvertKb ? (
              <Button type="button" variant="outline" onClick={() => void convertKb()}>
                Convert to KB
              </Button>
            ) : null}
          </div>
        }
      />
      {message ? <Alert>{message}</Alert> : null}
      {liveError ? <Alert variant="destructive">{liveError}</Alert> : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ticket sections">
        {(["details", "notes", "tasks", "attachments", "related"] as const).map((t) => (
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
        <>
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

          <Panel title="Copy ticket">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={copyTicket}>
              <div className="space-y-1">
                <Label htmlFor="copy-desk">Target desk</Label>
                <Select
                  id="copy-desk"
                  value={copyDeskId}
                  onChange={(e) => setCopyDeskId(e.target.value)}
                  required
                >
                  {(desks.length > 0 ? desks : desk ? [desk] : []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col justify-end gap-2 text-sm">
                <label htmlFor="copy-link" className="flex items-center gap-2">
                  <input
                    id="copy-link"
                    type="checkbox"
                    checked={copyLink}
                    onChange={(e) => setCopyLink(e.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  Link to original
                </label>
                <label htmlFor="copy-notes" className="flex items-center gap-2">
                  <input
                    id="copy-notes"
                    type="checkbox"
                    checked={copyIncludeNotes}
                    onChange={(e) => setCopyIncludeNotes(e.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  Include notes
                </label>
              </div>
              <div>
                <Button type="submit">Copy ticket</Button>
              </div>
            </form>
          </Panel>
        </>
      ) : null}

      {tab === "notes" ? (
        <Panel title="Notes">
          <div className="mb-4">
            <DataTable
              mode="client"
              caption="Ticket notes"
              columns={noteColumns}
              rows={(ticket.notes ?? []).map((noteRow) => ({
                id: noteRow.id,
                visibility: noteRow.is_public ? "public" : "private",
                created_at: noteRow.created_at ?? "",
                body: noteRow.body,
              }))}
              getRowId={(row) => row.id}
              emptyTitle="No notes yet."
            />
          </div>
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
          <div className="mb-4">
            <DataTable
              mode="client"
              caption="Ticket tasks"
              columns={taskColumns}
              rows={(ticket.tasks ?? []).map((task) => ({
                id: task.id,
                title: task.title,
                completion: task.is_completed ? "done" : "open",
                hours: taskHours(task.hours_worked),
                is_completed: task.is_completed,
              }))}
              getRowId={(row) => row.id}
              emptyTitle="No tasks yet."
            />
          </div>
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

      {tab === "attachments" ? (
        <Panel title="Attachments">
          <div className="mb-4">
            <DataTable
              mode="client"
              caption="Ticket attachments"
              columns={attachmentColumns}
              rows={ticket.attachments ?? []}
              getRowId={(row) => row.id}
              emptyTitle="No attachments yet."
            />
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={uploadAttachment}>
            <div className="space-y-1">
              <Label htmlFor="ticket-attachment-file">File</Label>
              <Input id="ticket-attachment-file" name="file" type="file" required />
            </div>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </form>
        </Panel>
      ) : null}

      {tab === "related" ? (
        <Panel title="Related">
          <DataTable
            mode="client"
            caption="Related links"
            columns={linkColumns}
            rows={ticket.links ?? []}
            getRowId={(row) => row.id}
            emptyTitle="No links."
          />
        </Panel>
      ) : null}
    </div>
  );
}
