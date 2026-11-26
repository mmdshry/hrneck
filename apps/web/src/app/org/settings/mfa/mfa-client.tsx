"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { useClientSnapshot } from "@/hooks/use-client-snapshot";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { formatDateTime } from "@/lib/format-datetime";
import type { SessionUser } from "@/lib/session";
import { toastError } from "@/lib/toast";
import { checkPasskeySupport, type PasskeyCheck } from "@/lib/webauthn";
import { AddPasskeyDialog } from "./add-passkey-dialog";
import { ChangePasswordDialog } from "./change-password-dialog";
import { DisableMfaDialog } from "./disable-mfa-dialog";
import { RemovePasskeyDialog } from "./remove-passkey-dialog";
import { TotpSetupWizard, type TotpSetup } from "./totp-setup-wizard";

type Passkey = {
  id: number;
  name: string;
  created_at: string | null;
  last_used_at: string | null;
};

/** Personal security timestamps follow the viewer's clock, unlike org data which uses the tenant zone. */
function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

type MfaSetupClientProps = {
  /** Shows the link back to the organization console settings. The employee portal copy hides it. */
  showSettingsLink?: boolean;
};

export function MfaSetupClient({ showSettingsLink = true }: MfaSetupClientProps) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [startingSetup, setStartingSetup] = useState(false);
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  /** null when the list loaded; otherwise the server's reason, or "" when none was given. */
  const [passkeysError, setPasskeysError] = useState<string | null>(null);
  const passkeyCheck = useClientSnapshot<PasskeyCheck>(
    checkPasskeySupport,
    () => "pending",
  );
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [removingPasskey, setRemovingPasskey] = useState<Passkey | null>(null);
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    void fetchSessionUser()
      .then(setUser)
      .catch(() => setUser(null));
    void api<{ data: Passkey[] }>("/api/v1/auth/passkeys")
      .then((res) => {
        setPasskeys(res.data);
        setPasskeysError(null);
      })
      .catch((err: unknown) =>
        setPasskeysError(err instanceof Error ? err.message : ""),
      );
  }, []);

  async function refreshUser() {
    setUser(await fetchSessionUser());
  }

  async function loadPasskeys() {
    try {
      const res = await api<{ data: Passkey[] }>("/api/v1/auth/passkeys");
      setPasskeys(res.data);
      setPasskeysError(null);
    } catch (err) {
      setPasskeysError(err instanceof Error ? err.message : "");
    }
  }

  async function reloadAccountState() {
    await Promise.all([loadPasskeys(), refreshUser()]);
  }

  function formatWhen(value: string | null): string {
    return formatDateTime(value, browserTimeZone(), locale);
  }

  async function beginTotpSetup() {
    setStartingSetup(true);
    try {
      await ensureCsrf();
      const res = await api<TotpSetup>("/api/v1/auth/mfa/setup", {
        method: "POST",
      });
      setSetup(res);
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("setupFailed"));
    } finally {
      setStartingSetup(false);
    }
  }

  const hasPasskeys = (passkeys?.length ?? 0) > 0;
  const canDisableWithPasskey = passkeyCheck === "supported" && hasPasskeys;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("securityTitle")}
        description={t("securityDescription")}
        actions={
          showSettingsLink ? (
            <LinkButton href="/org/settings" variant="secondary">
              {tNav("settings")}
            </LinkButton>
          ) : undefined
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

      <section className="mt-8 space-y-8">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          {t("mfaHeading")}
        </h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("status", {
            status: user?.mfa_enabled
              ? tCommon("enabled")
              : tCommon("notEnabled"),
          })}
        </p>

        <div className="space-y-4">
          <h3 className="text-base font-medium">
            {t("authenticatorAppHeading")}
          </h3>
          {user?.mfa_totp_enabled ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("authenticatorAppConnected")}
            </p>
          ) : (
            <Button
              type="button"
              disabled={startingSetup}
              onClick={() => void beginTotpSetup()}
            >
              {t("generateQr")}
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-base font-medium">{t("passkeysHeading")}</h3>
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("passkeysDescription")}
          </p>

          {passkeysError !== null ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 text-sm text-[var(--destructive)]"
            >
              <span>
                {t("passkeysLoadFailed")}
                {passkeysError ? ` ${passkeysError}` : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void loadPasskeys()}
              >
                {t("passkeysRetry")}
              </Button>
            </div>
          ) : null}

          {passkeys && passkeys.length === 0 && passkeysError === null ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("passkeysEmpty")}
            </p>
          ) : null}

          {hasPasskeys ? (
            <ul className="space-y-3">
              {passkeys?.map((passkey) => (
                <li
                  key={passkey.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-[var(--space-md)]"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{passkey.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t("passkeyCreatedAt", {
                        date: formatWhen(passkey.created_at),
                      })}
                      {" · "}
                      {passkey.last_used_at
                        ? t("passkeyLastUsedAt", {
                            date: formatWhen(passkey.last_used_at),
                          })
                        : t("passkeyNeverUsed")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRemovingPasskey(passkey)}
                  >
                    {t("passkeyRemove")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {passkeyCheck === "pending" ? null : passkeyCheck === "supported" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddingPasskey(true)}
            >
              {t("addPasskey")}
            </Button>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              {passkeyCheck === "insecure"
                ? t("passkeysNeedHttps")
                : t("passkeysUnsupported")}
            </p>
          )}
        </div>

        {user?.mfa_enabled ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDisablingMfa(true)}
          >
            {t("disableMfa")}
          </Button>
        ) : null}
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          {t("changePassword")}
        </h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setChangingPassword(true)}
        >
          {t("changePassword")}
        </Button>
      </section>

      {setup ? (
        <TotpSetupWizard
          setup={setup}
          onConfirmed={refreshUser}
          onClose={() => setSetup(null)}
        />
      ) : null}
      {addingPasskey ? (
        <AddPasskeyDialog
          onClose={() => setAddingPasskey(false)}
          onAdded={reloadAccountState}
        />
      ) : null}
      {removingPasskey ? (
        <RemovePasskeyDialog
          passkey={removingPasskey}
          onClose={() => setRemovingPasskey(null)}
          onRemoved={reloadAccountState}
        />
      ) : null}
      {disablingMfa ? (
        <DisableMfaDialog
          canUsePasskey={canDisableWithPasskey}
          onClose={() => setDisablingMfa(false)}
          onDisabled={reloadAccountState}
        />
      ) : null}
      {changingPassword ? (
        <ChangePasswordDialog onClose={() => setChangingPassword(false)} />
      ) : null}
    </div>
  );
}
