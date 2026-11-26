"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";

const MESSAGE_FORM_ID = "desk-message-template-form";
const NOTE_FORM_ID = "desk-note-template-form";

type TemplateDialogProps = {
  deskId: number;
  onClose: () => void;
  /** Runs after a successful save so the caller can reload the templates. */
  onSaved: () => void | Promise<void>;
};

export function MessageTemplateDialog({ deskId, onClose, onSaved }: TemplateDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/templates/messages", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: deskId,
          name,
          subject: subject || null,
          body,
        }),
      });
      toastSuccess(t("messageTemplateAdded"));
      onClose();
      await onSaved();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("addMessageTemplateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={t("addMessageTemplate")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={MESSAGE_FORM_ID} disabled={saving}>
            {t("addMessageTemplate")}
          </Button>
        </>
      }
    >
      <form id={MESSAGE_FORM_ID} className="grid gap-3" onSubmit={save}>
        <div className="space-y-1">
          <Label htmlFor="msg-tpl-name">{tCommon("name")}</Label>
          <Input
            id="msg-tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="msg-tpl-subject">{tCommon("subject")}</Label>
          <Input
            id="msg-tpl-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="msg-tpl-body">{tCommon("body")}</Label>
          <Textarea
            id="msg-tpl-body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
      </form>
    </Dialog>
  );
}

export function NoteTemplateDialog({ deskId, onClose, onSaved }: TemplateDialogProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      await api("/api/v1/org/ticketing/templates/notes", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desk_id: deskId,
          name,
          body,
        }),
      });
      toastSuccess(t("noteTemplateAdded"));
      onClose();
      await onSaved();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("addNoteTemplateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title={t("addNoteTemplate")}
      size="lg"
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={NOTE_FORM_ID} disabled={saving}>
            {t("addNoteTemplate")}
          </Button>
        </>
      }
    >
      <form id={NOTE_FORM_ID} className="grid gap-3" onSubmit={save}>
        <div className="space-y-1">
          <Label htmlFor="note-tpl-name">{tCommon("name")}</Label>
          <Input
            id="note-tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="note-tpl-body">{tCommon("body")}</Label>
          <Textarea
            id="note-tpl-body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>
      </form>
    </Dialog>
  );
}
