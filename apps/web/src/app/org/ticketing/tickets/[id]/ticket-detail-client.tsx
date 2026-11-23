"use client";

import { useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useState } from "react";
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
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
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

export function TicketDetailClient({ ticketId }: { ticketId: number }) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const noteColumnsI18n: Array<DataTableColumn<TicketNoteRow>> = [
    {
      id: "visibility",
      header: tCommon("visibility"),
      accessorKey: "visibility",
      filter: "select",
      filterOptions: [
        { label: tCommon("public"), value: "public" },
        { label: tCommon("private"), value: "private" },
      ],
      cell: (note) => (note.visibility === "public" ? tCommon("public") : tCommon("private")),
    },
    {
      id: "created_at",
      header: tCommon("created"),
      accessorKey: "created_at",
      cell: (note) => note.created_at || tCommon("emDash"),
    },
    {
      id: "body",
      header: t("note"),
      accessorKey: "body",
      className: "max-w-md whitespace-pre-wrap",
      cell: (note) => note.body,
    },
  ];
  const linkColumnsI18n: Array<DataTableColumn<TicketLink>> = [
    {
      id: "link_type",
      header: tCommon("link"),
      accessorKey: "link_type",
      sticky: true,
      cell: (link) => link.link_type,
    },
    {
      id: "related_type",
      header: t("relatedType"),
      accessorKey: "related_type",
      cell: (link) => link.related_type,
    },
    {
      id: "related_id",
      header: t("relatedId"),
      accessorKey: "related_id",
      filterValue: (link) => link.related_id,
      cell: (link) => `#${link.related_id}`,
    },
  ];
  const tenant = resolveTenant();
  const channel = tenant ? orgLiveChannel(tenant, "tickets") : null;
  const [ticket, setTicket] = useState<SdTicket | null>(null);
  const [desk, setDesk] = useState<SdDesk | null>(null);
  const [desks, setDesks] = useState<SdDesk[]>([]);
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
    const tenantId = resolveTenant();
    const res = await api<{ data: SdTicket }>(`/api/v1/org/ticketing/tickets/${ticketId}`, {
      tenant: tenantId,
    });
    setTicket(res.data);
    if (res.data.desk_id) {
      const d = await api<{ data: SdDesk }>(`/api/v1/org/ticketing/desks/${res.data.desk_id}`, {
        tenant: tenantId,
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
    if (liveError) {
      toastError(liveError);
    }
  }, [liveError]);

  useEffect(() => {
    setLoading(true);
    void refreshDetail()
      .catch((err: unknown) => toastError(err instanceof Error ? err.message : tCommon("loadFailed")))
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
      toastSuccess(t("saved"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("saveFailed"));
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
      toastError(err instanceof Error ? err.message : t("noteFailed"));
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
      toastError(err instanceof Error ? err.message : t("taskFailed"));
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
      toastError(err instanceof Error ? err.message : t("taskUpdateFailed"));
    }
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setUploading(true);
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
      toastSuccess(t("attachmentUploaded"));
      await refreshDetail();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("uploadFailed"));
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
      toastError(err instanceof Error ? err.message : tCommon("downloadFailed"));
    }
  }

  async function copyTicket(event: FormEvent) {
    event.preventDefault();
    const deskId = Number(copyDeskId);
    if (!deskId) {
      toastWarning(t("selectDeskForCopy"));
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
      toastError(err instanceof Error ? err.message : tCommon("copyFailed"));
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
      toastSuccess(t("kbArticleCreated", { id: res.data.id }));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("convertFailed"));
    }
  }

  const taskColumns: Array<DataTableColumn<TicketTaskRow>> = [
    {
      id: "title",
      header: tCommon("titleLabel"),
      accessorKey: "title",
      sticky: true,
      cell: (task) => task.title,
    },
    {
      id: "completion",
      header: tCommon("status"),
      accessorKey: "completion",
      filter: "select",
      filterOptions: [
        { label: tCommon("done"), value: "done" },
        { label: tCommon("open"), value: "open" },
      ],
      cell: (task) => (task.completion === "done" ? tCommon("done") : tCommon("open")),
    },
    {
      id: "hours",
      header: tCommon("hours"),
      accessorKey: "hours",
      filterValue: (task) => task.hours,
      cell: (task) => `${task.hours}h`,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (task) => (
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => void toggleTaskComplete(task.id, !task.is_completed)}
        >
          {task.is_completed ? t("markOpen") : t("markDone")}
        </Button>
      ),
    },
  ];

  const attachmentColumns: Array<DataTableColumn<TicketAttachment>> = [
    {
      id: "original_name",
      header: tCommon("file"),
      accessorKey: "original_name",
      sticky: true,
      cell: (row) => row.original_name,
    },
    {
      id: "mime",
      header: tCommon("type"),
      accessorKey: "mime",
      cell: (row) => row.mime || "—",
    },
    {
      id: "size",
      header: tCommon("size"),
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
        <Button
          type="button"
          variant="outline"
          size="compact"
          onClick={() => void downloadAttachment(row)}
        >
          {tCommon("download")}
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
        <PageHeader title={t("ticketDetail")} description={t("couldNotLoadTicket")} />
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
              {t("backToQueue")}
            </LinkButton>
            {canConvertKb ? (
              <Button type="button" variant="outline" onClick={() => void convertKb()}>
                {t("convertToKb")}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("ticketSections")}>
        {(["details", "notes", "tasks", "attachments", "related"] as const).map((section) => (
          <Button
            key={section}
            type="button"
            role="tab"
            aria-selected={tab === section}
            variant={tab === section ? "default" : "outline"}
            onClick={() => setTab(section)}
          >
            {section === "details"
              ? t("detailsPanel")
              : section === "notes"
                ? t("notesPanel")
                : section === "tasks"
                  ? t("tasksPanel")
                  : section === "attachments"
                    ? t("attachmentsPanel")
                    : t("relatedPanel")}
          </Button>
        ))}
      </div>

      {tab === "details" ? (
        <>
          <Panel title={t("detailsPanel")}>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={saveDetails}>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ticket-summary">{tCommon("summary")}</Label>
                <Input
                  id="ticket-summary"
                  value={ticket.summary}
                  onChange={(e) => setTicket({ ...ticket, summary: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="ticket-description">{tCommon("descriptionLabel")}</Label>
                <Textarea
                  id="ticket-description"
                  rows={5}
                  value={ticket.description ?? ""}
                  onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ticket-stage">{tCommon("stage")}</Label>
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
                <Label htmlFor="ticket-priority">{tCommon("priority")}</Label>
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
                <Label htmlFor="ticket-status">{tCommon("status")}</Label>
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
                <Label htmlFor="ticket-assignee-pool">{t("assigneePool")}</Label>
                <Input
                  id="ticket-assignee-pool"
                  value={ticket.assignee_pool ?? ""}
                  onChange={(e) => setTicket({ ...ticket, assignee_pool: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 text-sm text-[var(--muted-foreground)]">
                {t("escalationLevel", { level: ticket.escalation_level ?? 0 })}
                {ticket.sla_response_breached || ticket.sla_resolve_breached
                  ? t("slaBreachSuffix")
                  : ""}
              </div>
              <div>
                <Button type="submit">{tCommon("save")}</Button>
              </div>
            </form>
          </Panel>

          <Panel title={t("copyTicket")}>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={copyTicket}>
              <div className="space-y-1">
                <Label htmlFor="copy-desk">{t("targetDesk")}</Label>
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
                  {t("linkToOriginal")}
                </label>
                <label htmlFor="copy-notes" className="flex items-center gap-2">
                  <input
                    id="copy-notes"
                    type="checkbox"
                    checked={copyIncludeNotes}
                    onChange={(e) => setCopyIncludeNotes(e.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  {t("includeNotes")}
                </label>
              </div>
              <div>
                <Button type="submit">{t("copyTicket")}</Button>
              </div>
            </form>
          </Panel>
        </>
      ) : null}

      {tab === "notes" ? (
        <Panel title={tCommon("notes")}>
          <div className="mb-4">
            <DataTable
              mode="client"
              caption={t("ticketNotes")}
              columns={noteColumnsI18n}
              rows={(ticket.notes ?? []).map((noteRow) => ({
                id: noteRow.id,
                visibility: noteRow.is_public ? "public" : "private",
                created_at: noteRow.created_at ?? "",
                body: noteRow.body,
              }))}
              getRowId={(row) => row.id}
              emptyTitle={tCommon("noRows")}
            />
          </div>
          <form className="space-y-2" onSubmit={addNote}>
            <Label htmlFor="ticket-note-body">{t("note")}</Label>
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
              {t("visibleInPortal")}
            </label>
            <Button type="submit">{t("addNote")}</Button>
          </form>
        </Panel>
      ) : null}

      {tab === "tasks" ? (
        <Panel title={tCommon("tasks")}>
          <div className="mb-4">
            <DataTable
              mode="client"
              caption={t("ticketTasks")}
              columns={taskColumns}
              rows={(ticket.tasks ?? []).map((task) => ({
                id: task.id,
                title: task.title,
                completion: task.is_completed ? "done" : "open",
                hours: taskHours(task.hours_worked),
                is_completed: task.is_completed,
              }))}
              getRowId={(row) => row.id}
              emptyTitle={tCommon("noRows")}
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
              placeholder={t("taskTitle")}
              aria-label={t("taskTitle")}
              required
            />
            <Button type="submit">{tCommon("add")}</Button>
          </form>
        </Panel>
      ) : null}

      {tab === "attachments" ? (
        <Panel title={tCommon("attachments")}>
          <div className="mb-4">
            <DataTable
              mode="client"
              caption={t("ticketAttachments")}
              columns={attachmentColumns}
              rows={ticket.attachments ?? []}
              getRowId={(row) => row.id}
              emptyTitle={tCommon("noRows")}
            />
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={uploadAttachment}>
            <div className="space-y-1">
              <Label htmlFor="ticket-attachment-file">{tCommon("file")}</Label>
              <Input id="ticket-attachment-file" name="file" type="file" required />
            </div>
            <Button type="submit" disabled={uploading}>
              {uploading ? tCommon("uploading") : tCommon("upload")}
            </Button>
          </form>
        </Panel>
      ) : null}

      {tab === "related" ? (
        <Panel title={tCommon("related")}>
          <DataTable
            mode="client"
            caption={t("ticketRelated")}
            columns={linkColumnsI18n}
            rows={ticket.links ?? []}
            getRowId={(row) => row.id}
            emptyTitle={tCommon("noRows")}
          />
        </Panel>
      ) : null}
    </div>
  );
}
