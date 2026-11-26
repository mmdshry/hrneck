"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastInfo } from "@/lib/toast";
import { buildGroupFields } from "./ticket-dialog-logic";
import type { SdDesk } from "./ticketing-types";

const FORM_ID = "ticket-group-form";

type TicketGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  /** Desk shared by the selected tickets; supplies the stage and priority options. */
  deskId: number | null;
  onApply: (fields: Record<string, string | number>) => Promise<void>;
};

export function TicketGroupDialog({
  open,
  onOpenChange,
  selectedCount,
  deskId,
  onApply,
}: TicketGroupDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [wasOpen, setWasOpen] = useState(open);
  const [stageId, setStageId] = useState("");
  const [priorityId, setPriorityId] = useState("");
  const [assigneePool, setAssigneePool] = useState("");
  const [loaded, setLoaded] = useState<{ deskId: number; desk: SdDesk } | null>(null);
  const [saving, setSaving] = useState(false);

  // Each open starts with no changes chosen (state-from-props, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStageId("");
      setPriorityId("");
      setAssigneePool("");
    }
  }

  useEffect(() => {
    if (!open || !deskId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureCsrf();
        const detail = await api<{ data: SdDesk }>(`/api/v1/org/ticketing/desks/${deskId}`, {
          tenant: resolveTenant(),
        });
        if (!cancelled) setLoaded({ deskId, desk: detail.data });
      } catch {
        if (!cancelled) setLoaded(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, deskId]);

  // Ignore options loaded for a previous desk so stale stages never show.
  const desk = loaded && loaded.deskId === deskId ? loaded.desk : null;

  async function applyGroup(event: FormEvent) {
    event.preventDefault();
    const fields = buildGroupFields({ stageId, priorityId, assigneePool });
    if (!fields) {
      toastInfo(t("chooseFieldToUpdate"));
      return;
    }
    setSaving(true);
    try {
      await onApply(fields);
      onOpenChange(false);
    } catch {
      /* the bulk action already showed the error; keep the dialog open to retry */
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("groupUpdate")}
      description={t("groupUpdateDescription", { count: selectedCount })}
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
            {saving ? tCommon("saving") : t("applyToSelected")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-3" onSubmit={(e) => void applyGroup(e)}>
        <div className="space-y-1">
          <Label htmlFor="group-stage">{tCommon("stage")}</Label>
          <Select id="group-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}>
            <option value="">{t("noChange")}</option>
            {(desk?.stages ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="group-priority">{tCommon("priority")}</Label>
          <Select
            id="group-priority"
            value={priorityId}
            onChange={(e) => setPriorityId(e.target.value)}
          >
            <option value="">{t("noChange")}</option>
            {(desk?.priorities ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="group-pool">{t("assigneePool")}</Label>
          <Input
            id="group-pool"
            value={assigneePool}
            onChange={(e) => setAssigneePool(e.target.value)}
            placeholder={t("assigneePoolPlaceholder")}
          />
        </div>
        {!desk ? (
          <p className="text-sm text-[var(--muted-foreground)]">{t("groupUpdateHint")}</p>
        ) : null}
      </form>
    </Dialog>
  );
}
