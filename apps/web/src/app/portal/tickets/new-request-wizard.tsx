"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import type { Desk } from "./portal-ticket-types";

type NewRequestWizardProps = {
  desks: Desk[];
  onClose: () => void;
};

type CreatedTicket = { data: { id: number } };

export function NewRequestWizard({ desks, onClose }: NewRequestWizardProps) {
  const t = useTranslations("portal");
  const tCommon = useTranslations("common");
  const labels = useWizardLabels({ submit: t("submit") });
  const deskRef = useRef<HTMLSelectElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);
  const [chosenDeskId, setChosenDeskId] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Desks load with the page, so until the user picks one the first desk is used.
  const deskId = chosenDeskId || (desks[0] ? String(desks[0].id) : "");
  const selectedDeskName = desks.find((desk) => String(desk.id) === deskId)?.name ?? tCommon("emDash");

  async function submitRequest() {
    setSaving(true);
    try {
      await ensureCsrf();
      const created = await api<CreatedTicket>("/api/v1/org/portal/ticketing/tickets", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desk_id: Number(deskId), summary, description }),
      });
      // Stay busy until the browser navigates to the new ticket.
      window.location.href = `/portal/tickets/${created.data.id}`;
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("createFailed"));
      setSaving(false);
    }
  }

  const steps: WizardStep[] = [
    {
      id: "desk",
      title: tCommon("desk"),
      validate: () => deskRef.current?.reportValidity() ?? false,
      render: () => (
        <div className="space-y-1.5">
          <Label htmlFor="portal-desk">{tCommon("desk")}</Label>
          <Select
            id="portal-desk"
            ref={deskRef}
            value={deskId}
            onChange={(e) => setChosenDeskId(e.target.value)}
            required
          >
            {desks.map((desk) => (
              <option key={desk.id} value={desk.id}>
                {desk.name}
              </option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      id: "details",
      title: tCommon("details"),
      validate: () => summaryRef.current?.reportValidity() ?? false,
      render: () => (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="portal-summary">{t("summary")}</Label>
            <Input
              id="portal-summary"
              ref={summaryRef}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="portal-details">{t("details")}</Label>
            <Textarea
              id="portal-details"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      ),
    },
    {
      id: "review",
      title: t("reviewRequest"),
      render: () => (
        <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          <dt className="text-[var(--muted-foreground)]">{tCommon("desk")}</dt>
          <dd>{selectedDeskName}</dd>
          <dt className="text-[var(--muted-foreground)]">{t("summary")}</dt>
          <dd className="break-words">{summary.trim()}</dd>
          <dt className="text-[var(--muted-foreground)]">{t("details")}</dt>
          <dd className="break-words whitespace-pre-wrap">
            {description.trim() || tCommon("emDash")}
          </dd>
        </dl>
      ),
    },
  ];

  return (
    <WizardDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("newRequest")}
      steps={steps}
      onSubmit={submitRequest}
      labels={labels}
      busy={saving}
      isDirty={summary !== "" || description !== ""}
    />
  );
}
