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
import { toastError, toastInfo, toastSuccess } from "@/lib/toast";
import type { SdDesk, SdTicket } from "./ticketing-types";

const FORM_ID = "new-ticket-form";

type NewTicketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desks: SdDesk[];
  defaultDeskId: number | null;
};

export function NewTicketDialog({
  open,
  onOpenChange,
  desks,
  defaultDeskId,
}: NewTicketDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [wasOpen, setWasOpen] = useState(open);
  const [deskId, setDeskId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Each open starts from the default desk and an empty form (state-from-props, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDeskId(defaultDeskId ? String(defaultDeskId) : "");
      setSummary("");
      setDescription("");
    }
  }

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    const desk = Number(deskId);
    if (!desk) {
      toastInfo(t("selectDeskBeforeCreate"));
      return;
    }
    setSaving(true);
    try {
      await ensureCsrf();
      const created = await api<{ data: SdTicket }>("/api/v1/org/ticketing/tickets", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: desk,
          summary,
          description: description || null,
        }),
      });
      toastSuccess(t("createdTicket", { number: created.data.number }));
      // Stay busy until the browser navigates to the new ticket.
      window.location.assign(`/org/ticketing/tickets/${created.data.id}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("createFailed"));
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("newTicket")}
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
            {saving ? tCommon("saving") : t("createTicket")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-3" onSubmit={(e) => void createTicket(e)}>
        <div className="space-y-1">
          <Label htmlFor="new-ticket-desk">{tCommon("desk")}</Label>
          <Select
            id="new-ticket-desk"
            value={deskId}
            onChange={(e) => setDeskId(e.target.value)}
            required
          >
            {desks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-ticket-summary">{tCommon("summary")}</Label>
          <Input
            id="new-ticket-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-ticket-description">{tCommon("descriptionLabel")}</Label>
          <Textarea
            id="new-ticket-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
      </form>
    </Dialog>
  );
}
