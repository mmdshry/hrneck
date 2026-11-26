"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

type RemovePasskeyDialogProps = {
  passkey: { id: number; name: string };
  onClose: () => void;
  /** Reloads the passkey list and the signed-in user after the passkey is removed. */
  onRemoved: () => void | Promise<void>;
};

export function RemovePasskeyDialog({ passkey, onClose, onRemoved }: RemovePasskeyDialogProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const [password, setPassword] = useState("");
  const [removing, setRemoving] = useState(false);

  async function removePasskey(event: FormEvent) {
    event.preventDefault();
    setRemoving(true);
    try {
      await ensureCsrf();
      await api(`/api/v1/auth/passkeys/${passkey.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      toastSuccess(t("passkeyRemoved"));
      await onRemoved();
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("passkeyRemoveFailed"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog
      open
      role="alertdialog"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("passkeyRemoveTitle", { name: passkey.name })}
      description={t("passkeyRemoveDescription")}
      busy={removing}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={removing} onClick={() => onClose()}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="submit"
            form="remove-passkey-form"
            variant="destructive"
            disabled={removing}
          >
            {removing ? tCommon("working") : t("passkeyRemoveConfirm")}
          </Button>
        </>
      }
    >
      <form
        id="remove-passkey-form"
        onSubmit={(event) => void removePasskey(event)}
        className="space-y-1"
      >
        <Label htmlFor="remove-passkey-password" className="text-[var(--muted-foreground)]">
          {t("password")}
        </Label>
        <Input
          id="remove-passkey-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </form>
    </Dialog>
  );
}
