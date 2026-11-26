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
import type { Target } from "./target-types";

type SetEmployeePasswordDialogProps = {
  target: Target | null;
  onClose: () => void;
};

/**
 * Admin sets an employee's login password directly. Mounted with a `key` per target
 * so the fields reset every time it opens.
 */
export function SetEmployeePasswordDialog({ target, onClose }: SetEmployeePasswordDialogProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!target) return;

    if (password !== confirmation) {
      setError(t("passwordMismatch"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await ensureCsrf();
      await api(`/api/v1/org/targets/${target.id}/password`, {
        method: "POST",
        tenant: resolveTenant(),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, password_confirmation: confirmation }),
      });
      toastSuccess(t("passwordSet"));
      onClose();
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title={t("setPasswordTitle")}
      description={target ? t("setPasswordDescription", { email: target.email }) : undefined}
      dismissible={!saving}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button
            type="submit"
            form="set-employee-password-form"
            disabled={saving || password.length < 8 || confirmation.length < 8}
          >
            {saving ? tCommon("saving") : t("setPasswordSubmit")}
          </Button>
        </>
      }
    >
      <form
        id="set-employee-password-form"
        onSubmit={(e) => void onSubmit(e)}
        className="space-y-4"
      >
        <div className="space-y-1">
          <Label htmlFor="employee-new-password">{t("newPassword")}</Label>
          <Input
            id="employee-new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="employee-confirm-password">{t("confirmPassword")}</Label>
          <Input
            id="employee-confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmation}
            onChange={(e) => {
              setConfirmation(e.target.value);
              setError(null);
            }}
            required
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[var(--destructive)]">
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
