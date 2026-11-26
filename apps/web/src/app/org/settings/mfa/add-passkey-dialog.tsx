"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { createPasskey, type ServerCreationOptions } from "@/lib/webauthn";
import { passkeyErrorMessage } from "./passkey-error-message";
import { RecoveryCodesPanel } from "./recovery-codes-panel";

type AddPasskeyDialogProps = {
  onClose: () => void;
  /** Reloads the passkey list and the signed-in user after a passkey is saved. */
  onAdded: () => void | Promise<void>;
};

/**
 * Registers a passkey. The first factor a user adds turns MFA on and issues recovery codes,
 * so the codes replace the form in this dialog until it is closed.
 */
export function AddPasskeyDialog({ onClose, onAdded }: AddPasskeyDialogProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function addPasskey(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    try {
      await ensureCsrf();
      const options = await api<ServerCreationOptions>(
        "/api/v1/auth/passkeys/register/options",
        {
          method: "POST",
        },
      );
      const credential = await createPasskey(options);
      const res = await api<{ recovery_codes?: string[] }>(
        "/api/v1/auth/passkeys/register/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential, name: name.trim() }),
        },
      );
      toastSuccess(t("passkeyAdded"));
      await onAdded();
      if (Array.isArray(res.recovery_codes) && res.recovery_codes.length > 0) {
        setRecoveryCodes(res.recovery_codes);
      } else {
        onClose();
      }
    } catch (err) {
      toastError(passkeyErrorMessage(err, t("passkeyAddFailed"), t("passkeyCancelled")));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={recoveryCodes !== null ? t("recoveryCodes") : t("addPasskey")}
      busy={adding}
      closeLabel={tCommon("close")}
      footer={
        recoveryCodes !== null ? (
          <Button type="button" autoFocus onClick={onClose}>
            {tCommon("done")}
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" disabled={adding} onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" form="add-passkey-form" disabled={adding}>
              {adding ? tCommon("working") : t("addPasskey")}
            </Button>
          </>
        )
      }
    >
      {recoveryCodes !== null ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("recoveryCodesDescription")}
          </p>
          <RecoveryCodesPanel codes={recoveryCodes} />
        </div>
      ) : (
        <form
          id="add-passkey-form"
          onSubmit={(event) => void addPasskey(event)}
          className="space-y-1"
        >
          <Label htmlFor="passkey-name" className="text-[var(--muted-foreground)]">
            {t("passkeyName")}
          </Label>
          <Input
            id="passkey-name"
            value={name}
            maxLength={100}
            placeholder={t("passkeyNamePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </form>
      )}
    </Dialog>
  );
}
