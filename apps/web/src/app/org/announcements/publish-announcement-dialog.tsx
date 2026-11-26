"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import type { Announcement } from "./announcement-types";

const FORM_ID = "publish-announcement-form";
const TITLE_MAX_LENGTH = 190;
const BODY_MAX_LENGTH = 5000;

type PublishAnnouncementDialogProps = {
  onClose: () => void;
  onPublished: (created: Announcement | undefined) => Promise<void>;
};

export function PublishAnnouncementDialog({ onClose, onPublished }: PublishAnnouncementDialogProps) {
  const t = useTranslations("org.announcements");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [publishing, setPublishing] = useState(false);

  async function publish(event: FormEvent) {
    event.preventDefault();
    setPublishing(true);
    try {
      await ensureCsrf();
      const res = (await api("/api/v1/org/announcements", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      })) as { data?: Announcement };
      await onPublished(res.data);
      toastSuccess(t("announcementPublished"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("publishFailed"));
      setPublishing(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("newAnnouncement")}
      busy={publishing}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={publishing} onClick={() => onClose()}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={publishing}>
            {publishing ? t("publishing") : t("publish")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="space-y-4" onSubmit={(e) => void publish(e)}>
        <div className="space-y-1">
          <Label htmlFor="announcement-title">{tCommon("titleLabel")}</Label>
          <Input
            id="announcement-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={TITLE_MAX_LENGTH}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="announcement-body">{tCommon("message")}</Label>
          <Textarea
            id="announcement-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={BODY_MAX_LENGTH}
            rows={5}
          />
        </div>
      </form>
    </Dialog>
  );
}
