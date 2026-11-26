"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api, ensureCsrf } from "@/lib/api";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";

type WebhookTestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Webhook URL from the settings form, possibly unsaved. A blank value delivers nothing. */
  url: string;
};

export function WebhookTestDialog({ open, onOpenChange, url }: WebhookTestDialogProps) {
  const t = useTranslations("org.settings");
  const tCommon = useTranslations("common");
  const [sending, setSending] = useState(false);
  const trimmedUrl = url.trim();

  async function sendTest() {
    setSending(true);
    try {
      await ensureCsrf();
      await api("/api/v1/org/webhooks/test", {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl || undefined,
          event: "settings.webhook_test",
          payload: { source: "org.settings" },
        }),
      });
      toastSuccess(t("testWebhookQueued"));
      onOpenChange(false);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("webhookTestFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("webhookTestTitle")}
      busy={sending}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="button" disabled={sending} onClick={() => void sendTest()}>
            {sending ? tCommon("sending") : t("sendTest")}
          </Button>
        </>
      }
    >
      {trimmedUrl ? (
        <p className="break-all text-sm text-[var(--muted-foreground)]">
          {t("webhookTestDescription", { url: trimmedUrl })}
        </p>
      ) : (
        <p className="text-sm text-[var(--muted-foreground)]">{t("webhookTestMissingUrl")}</p>
      )}
    </Dialog>
  );
}
