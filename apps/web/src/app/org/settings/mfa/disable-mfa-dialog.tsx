"use client";

import { FormEvent, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { getPasskeyAssertion, type ServerRequestOptions } from "@/lib/webauthn";
import { passkeyErrorMessage } from "./passkey-error-message";

type DisableMfaDialogProps = {
  /** Offers confirming with a passkey instead of a code. Needs a passkey and browser support. */
  canUsePasskey: boolean;
  onClose: () => void;
  /** Reloads the passkey list and the signed-in user after MFA is turned off. */
  onDisabled: () => void | Promise<void>;
};

export function DisableMfaDialog({ canUsePasskey, onClose, onDisabled }: DisableMfaDialogProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  async function finishDisable() {
    toastSuccess(t("mfaDisabled"));
    await onDisabled();
    onClose();
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      await api("/api/v1/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      });
      await finishDisable();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("disableFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function disableWithPasskey() {
    if (!passwordRef.current?.reportValidity()) {
      return;
    }

    setSaving(true);
    try {
      await ensureCsrf();
      const options = await api<ServerRequestOptions>(
        "/api/v1/auth/passkeys/assertion/options",
        {
          method: "POST",
        },
      );
      const passkey = await getPasskeyAssertion(options);
      await api("/api/v1/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, passkey }),
      });
      await finishDisable();
    } catch (err) {
      toastError(passkeyErrorMessage(err, t("disableFailed"), t("passkeyCancelled")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      role="alertdialog"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("disableMfa")}
      description={t("disableMfaWarning")}
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => onClose()}>
            {tCommon("cancel")}
          </Button>
          {canUsePasskey ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void disableWithPasskey()}
            >
              {t("disableWithPasskey")}
            </Button>
          ) : null}
          <Button
            type="submit"
            form="disable-mfa-form"
            variant="destructive"
            disabled={saving}
          >
            {saving ? tCommon("working") : t("disableMfa")}
          </Button>
        </>
      }
    >
      <form
        id="disable-mfa-form"
        onSubmit={(event) => void disable(event)}
        className="grid gap-3"
      >
        <p className="text-sm text-[var(--muted-foreground)]">{t("disableHint")}</p>
        <div className="space-y-1">
          <Label htmlFor="disable-password">{t("password")}</Label>
          <Input
            id="disable-password"
            ref={passwordRef}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="disable-code">{t("authenticatorOrRecovery")}</Label>
          <Input
            id="disable-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
      </form>
    </Dialog>
  );
}
