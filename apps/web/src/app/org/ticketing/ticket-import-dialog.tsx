"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { toImportPayload } from "./ticket-dialog-logic";

const FORM_ID = "ticket-import-form";

type TicketImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
};

export function TicketImportDialog({ open, onOpenChange, onImported }: TicketImportDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [wasOpen, setWasOpen] = useState(open);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Each open starts without a file chosen (state-from-props, no effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFile(null);
    }
  }

  async function importFile(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      return;
    }
    let payload: { tickets: unknown };
    try {
      payload = toImportPayload(JSON.parse(await file.text()));
    } catch {
      toastError(t("importInvalidJson"));
      return;
    }
    setSaving(true);
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/import", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toastSuccess(t("importComplete"));
      onOpenChange(false);
      await onImported();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("importFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("importTickets")}
      description={t("importTicketsDescription")}
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
          <Button type="submit" form={FORM_ID} disabled={saving || !file}>
            {saving ? tCommon("saving") : tCommon("import")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-1" onSubmit={(e) => void importFile(e)}>
        <Label htmlFor="import-file">{t("jsonExportFile")}</Label>
        <Input
          id="import-file"
          name="import_file"
          type="file"
          accept="application/json,.json"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </form>
    </Dialog>
  );
}
