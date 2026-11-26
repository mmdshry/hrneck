"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { normalizeTicketPreferences, type TicketPreferences } from "./ticket-dialog-logic";
import type { SdDesk } from "./ticketing-types";

const FORM_ID = "ticket-preferences-form";

type TicketPreferencesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: TicketPreferences;
  desks: SdDesk[];
  onSaved: (prefs: TicketPreferences) => void;
};

export function TicketPreferencesDialog({
  open,
  onOpenChange,
  prefs,
  desks,
  onSaved,
}: TicketPreferencesDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [wasOpen, setWasOpen] = useState(open);
  const [draft, setDraft] = useState(prefs);
  const [saving, setSaving] = useState(false);

  // Each open edits the latest saved preferences (state-from-props, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(prefs);
    }
  }

  async function savePreferences(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      const res = await api<{ data: TicketPreferences }>("/api/v1/org/ticketing/preferences", {
        method: "PUT",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_scope: draft.ticket_scope,
          email_send_delay_minutes: Number(draft.email_send_delay_minutes) || 0,
          default_desk_id: draft.default_desk_id,
        }),
      });
      onSaved(normalizeTicketPreferences(res.data));
      toastSuccess(t("preferencesSaved"));
      onOpenChange(false);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("preferencesFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("preferences")}
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
            {saving ? tCommon("saving") : t("savePreferences")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-3" onSubmit={(e) => void savePreferences(e)}>
        <div className="space-y-1">
          <Label htmlFor="pref-scope">{t("ticketScope")}</Label>
          <Select
            id="pref-scope"
            value={draft.ticket_scope}
            onChange={(e) => setDraft((prev) => ({ ...prev, ticket_scope: e.target.value }))}
          >
            <option value="all">{tCommon("all")}</option>
            <option value="assigned">{tCommon("assigned")}</option>
            <option value="own">{tCommon("own")}</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pref-delay">{t("emailSendDelay")}</Label>
          <Input
            id="pref-delay"
            type="number"
            min={0}
            max={1440}
            value={draft.email_send_delay_minutes}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                email_send_delay_minutes: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pref-desk">{t("defaultDesk")}</Label>
          <Select
            id="pref-desk"
            value={draft.default_desk_id != null ? String(draft.default_desk_id) : ""}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                default_desk_id: e.target.value ? Number(e.target.value) : null,
              }))
            }
          >
            <option value="">{tCommon("none")}</option>
            {desks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      </form>
    </Dialog>
  );
}
