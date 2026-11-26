"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

type ChangePasswordDialogProps = {
  onClose: () => void;
};

export function ChangePasswordDialog({ onClose }: ChangePasswordDialogProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await ensureCsrf();
      await api("/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: newPasswordConfirmation,
        }),
      });
      toastSuccess(t("passwordUpdated"));
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("passwordUpdateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("changePassword")}
      busy={saving}
      closeLabel={tCommon("close")}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => onClose()}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form="change-password-form" disabled={saving}>
            {saving ? tCommon("saving") : t("updatePassword")}
          </Button>
        </>
      }
    >
      <form
        id="change-password-form"
        onSubmit={(event) => void changePassword(event)}
        className="grid gap-3"
      >
        <div className="space-y-1">
          <Label htmlFor="current-password">{t("currentPassword")}</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new-password-confirmation">{t("confirmNewPassword")}</Label>
          <Input
            id="new-password-confirmation"
            type="password"
            autoComplete="new-password"
            value={newPasswordConfirmation}
            onChange={(e) => setNewPasswordConfirmation(e.target.value)}
            required
          />
        </div>
      </form>
    </Dialog>
  );
}
