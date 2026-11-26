"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog, type WizardStep } from "@/components/ui/wizard-dialog";
import { api, ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { RecoveryCodesPanel } from "./recovery-codes-panel";

export type TotpSetup = {
  secret: string;
  otpauth_url: string;
  qr_svg: string;
};

type TotpSetupWizardProps = {
  setup: TotpSetup;
  /** Called after the code is confirmed, so the caller can reload the signed-in user. */
  onConfirmed: () => void | Promise<void>;
  onClose: () => void;
};

/**
 * Scan the QR, confirm the first code, then show the recovery codes once. The code is
 * confirmed on the second step's Next, and the codes appear only on the last step.
 */
export function TotpSetupWizard({ setup, onConfirmed, onClose }: TotpSetupWizardProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const labels = useWizardLabels({ submit: tCommon("done") });
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function confirmCode(): Promise<boolean> {
    if (recoveryCodes !== null) {
      return true;
    }

    try {
      await ensureCsrf();
      const res = await api<{ recovery_codes?: string[] }>("/api/v1/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(Array.isArray(res.recovery_codes) ? res.recovery_codes : []);
      setCode("");
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("confirmFailed"));
      return false;
    }

    toastSuccess(t("mfaConfirmed"));
    await onConfirmed();
    return true;
  }

  const steps: WizardStep[] = [
    {
      id: "scan",
      title: t("totpScanTitle"),
      description: t("totpScanDescription"),
      render: () => (
        <div className="space-y-4">
          <div
            role="img"
            aria-label={t("authenticatorQr")}
            className="inline-block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]"
            dangerouslySetInnerHTML={{ __html: setup.qr_svg }}
          />
          <p className="text-sm text-[var(--muted-foreground)] break-all">
            {t("secret", { secret: setup.secret })}
          </p>
        </div>
      ),
    },
    {
      id: "code",
      title: t("totpCodeTitle"),
      description: t("totpCodeDescription"),
      validate: confirmCode,
      render: () => (
        <div className="space-y-1">
          <Label htmlFor="mfa-code" className="text-[var(--muted-foreground)]">
            {t("code")}
          </Label>
          <Input
            id="mfa-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
          />
        </div>
      ),
    },
    {
      id: "recovery",
      title: t("recoveryCodes"),
      description: t("recoveryCodesDescription"),
      render: () => <RecoveryCodesPanel codes={recoveryCodes ?? []} />,
    },
  ];

  return (
    <WizardDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("authenticatorAppHeading")}
      steps={steps}
      onSubmit={onClose}
      labels={labels}
      isDirty={code !== "" && recoveryCodes === null}
    />
  );
}
