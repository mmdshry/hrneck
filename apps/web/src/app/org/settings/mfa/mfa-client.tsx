"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import { toastError, toastSuccess } from "@/lib/toast";

type Setup = {
  secret: string;
  otpauth_url: string;
  qr_svg: string;
};

export function MfaSetupClient() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    void fetchSessionUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function begin() {
    setRecoveryCodes(null);
    try {
      await ensureCsrf();
      const res = await api<Setup>("/api/v1/auth/mfa/setup", { method: "POST" });
      setSetup(res);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("setupFailed"));
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      const res = await api<{ recovery_codes?: string[] }>("/api/v1/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(Array.isArray(res.recovery_codes) ? res.recovery_codes : []);
      setSetup(null);
      setCode("");
      toastSuccess(t("mfaConfirmed"));
      const refreshed = await fetchSessionUser();
      setUser(refreshed);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("confirmFailed"));
    }
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      await api("/api/v1/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      setDisablePassword("");
      setDisableCode("");
      setRecoveryCodes(null);
      toastSuccess(t("mfaDisabled"));
      const refreshed = await fetchSessionUser();
      setUser(refreshed);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("disableFailed"));
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
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
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      toastSuccess(t("passwordUpdated"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("passwordUpdateFailed"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("securityTitle")}
        description={t("securityDescription")}
        actions={
          <LinkButton href="/org/settings" variant="secondary">
            {tNav("settings")}
          </LinkButton>
        }
      />

      <section className="mt-8 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          {t("languageSection")}
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("languageDescription")}
        </p>
        <LanguageSwitcher variant="list" />
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{t("mfaHeading")}</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("status", {
            status: user?.mfa_enabled ? tCommon("enabled") : tCommon("notEnabled"),
          })}
        </p>
        {!user?.mfa_enabled ? (
          <Button type="button" onClick={() => void begin()}>
            {t("generateQr")}
          </Button>
        ) : null}
        {setup ? (
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
            <form onSubmit={confirm} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1 space-y-1">
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
              <Button type="submit" variant="secondary">
                {t("confirm")}
              </Button>
            </form>
          </div>
        ) : null}
        {recoveryCodes && recoveryCodes.length > 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--success)]/40 bg-[var(--success)]/10 px-[var(--space-md)] py-[var(--space-sm)] text-sm text-[var(--success)]">
            <p className="font-medium">{t("recoveryCodes")}</p>
            <ul className="mt-2 list-disc pl-5 font-mono text-xs">
              {recoveryCodes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {user?.mfa_enabled ? (
          <form onSubmit={disable} className="mt-4 grid max-w-md gap-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("disableHint")}
            </p>
            <div className="space-y-1">
              <Label htmlFor="disable-password">{t("password")}</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="disable-code">{t("authenticatorOrRecovery")}</Label>
              <Input
                id="disable-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="secondary">
              {t("disableMfa")}
            </Button>
          </form>
        ) : null}
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">{t("changePassword")}</h2>
        <form onSubmit={changePassword} className="grid max-w-md gap-3">
          <div className="space-y-1">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input
              id="current-password"
              type="password"
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
              value={newPasswordConfirmation}
              onChange={(e) => setNewPasswordConfirmation(e.target.value)}
              required
            />
          </div>
          <Button type="submit">{t("updatePassword")}</Button>
        </form>
      </section>
    </div>
  );
}
