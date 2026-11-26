"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import type { SdDesk, SdTicket } from "../../ticketing-types";

const FORM_ID = "ticket-details-form";

type DetailsDraft = Pick<
  SdTicket,
  "summary" | "description" | "stage_id" | "priority_id" | "status_id" | "assignee_pool"
>;

function toDraft(ticket: SdTicket): DetailsDraft {
  return {
    summary: ticket.summary,
    description: ticket.description,
    stage_id: ticket.stage_id,
    priority_id: ticket.priority_id,
    status_id: ticket.status_id,
    assignee_pool: ticket.assignee_pool,
  };
}

type TicketDetailsEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: SdTicket;
  desk: SdDesk | null;
  onSaved: (ticket: SdTicket) => void;
};

export function TicketDetailsEditDialog({
  open,
  onOpenChange,
  ticket,
  desk,
  onSaved,
}: TicketDetailsEditDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [wasOpen, setWasOpen] = useState(open);
  const [draft, setDraft] = useState<DetailsDraft>(() => toDraft(ticket));
  const [saving, setSaving] = useState(false);

  // Each open edits the latest saved values (state-from-props, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(toDraft(ticket));
    }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      const updated = await api<{ data: SdTicket }>(`/api/v1/org/ticketing/tickets/${ticket.id}`, {
        method: "PATCH",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: draft.summary,
          description: draft.description,
          stage_id: draft.stage_id,
          status_id: draft.status_id,
          priority_id: draft.priority_id,
          assignee_pool: draft.assignee_pool,
        }),
      });
      onSaved(updated.data);
      toastSuccess(t("saved"));
      onOpenChange(false);
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("editDetails")}
      size="xl"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={saving}>
            {saving ? tCommon("saving") : tCommon("save")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void saveDetails(e)}>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ticket-summary">{tCommon("summary")}</Label>
          <Input
            id="ticket-summary"
            value={draft.summary}
            onChange={(e) => setDraft((prev) => ({ ...prev, summary: e.target.value }))}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ticket-description">{tCommon("descriptionLabel")}</Label>
          <Textarea
            id="ticket-description"
            rows={5}
            value={draft.description ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ticket-stage">{tCommon("stage")}</Label>
          <Select
            id="ticket-stage"
            value={String(draft.stage_id ?? "")}
            onChange={(e) => setDraft((prev) => ({ ...prev, stage_id: Number(e.target.value) }))}
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
            value={String(draft.priority_id ?? "")}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, priority_id: Number(e.target.value) }))
            }
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
            value={String(draft.status_id ?? "")}
            onChange={(e) => setDraft((prev) => ({ ...prev, status_id: Number(e.target.value) }))}
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
            value={draft.assignee_pool ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, assignee_pool: e.target.value }))}
          />
        </div>
      </form>
    </Dialog>
  );
}
