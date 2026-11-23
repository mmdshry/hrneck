"use client";

import { FormEvent, useEffect, useState } from "react";
import { toastError } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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

type PortalNote = NonNullable<Ticket["notes"]>[number];

export function PortalTicketDetailClient({ ticketId }: { ticketId: number }) {
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  const dash = tCommon("emDash");

  const noteColumns: Array<DataTableColumn<PortalNote>> = [
    {
      id: "body",
      header: t("note"),
      accessorKey: "body",
      sticky: true,
      className: "max-w-md whitespace-pre-wrap",
      cell: (row) => row.body,
    },
    {
      id: "created_at",
      header: t("created"),
      filterValue: (row) => row.created_at ?? "",
      cell: (row) => row.created_at || dash,
    },
  ];

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
      .catch((err: unknown) => toastError(err instanceof Error ? err.message : t("loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when ticket id changes
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
      toastError(err instanceof Error ? err.message : t("noteFailed"));
    }
  }

  if (loading) {
    return <PageSkeleton variant="detail" />;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("ticket")} description={t("couldNotLoadTicket")} />
        
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.number}
        description={ticket.summary}
        actions={
          <LinkButton href="/portal/tickets" variant="outline">
            {tCommon("back")}
          </LinkButton>
        }
      />
      
      <Panel title={t("details")}>
        <p className="mb-2 text-sm text-[var(--muted-foreground)]">
          {ticket.stage?.name} / {ticket.status?.name}
        </p>
        <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
      </Panel>
      <Panel title={t("conversation")}>
        <div className="mb-4">
          <DataTable
            mode="client"
            caption={t("ticketNotes")}
            columns={noteColumns}
            rows={ticket.notes ?? []}
            getRowId={(row) => row.id}
            emptyTitle={t("noNotesYet")}
          />
        </div>
        <form className="space-y-2" onSubmit={addNote}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} required />
          <Button type="submit">{t("addNote")}</Button>
        </form>
      </Panel>
    </div>
  );
}
