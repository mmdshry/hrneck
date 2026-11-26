"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClientSnapshot } from "@/hooks/use-client-snapshot";
import { api, ensureCsrf } from "@/lib/api";
import type { SessionUser } from "@/lib/session";
import { toastError } from "@/lib/toast";
import {
  checkPasskeySupport,
  getPasskeyAssertion,
  isPasskeyCancelled,
  type PasskeyCheck,
  type ServerRequestOptions,
} from "@/lib/webauthn";

export type MfaMethods = { totp: boolean; passkey: boolean };

type OrgMfaStepProps = {
  challengeToken: string;
  methods: MfaMethods;
  onVerified: (user: SessionUser | undefined) => void;
  onCancel: () => void;
};

type VerifyResult = { data?: SessionUser };

/** Same wording the API uses for a dead challenge; /login/mfa treats these the same way. */
function isExpiredChallenge(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("expired") || lower.includes("sign in again");
}

/**
 * Second factor for a sign-in that started on /select-org. Same endpoints as /login/mfa, but the user stays on
 * this page so the organization opens on its own subdomain once the factor is accepted.
 */
export function OrgMfaStep({ challengeToken, methods, onVerified, onCancel }: OrgMfaStepProps) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const passkeyCheck = useClientSnapshot<PasskeyCheck>(checkPasskeySupport, () => "pending");
  const totp = methods.totp;

  function handleFailure(message: string) {
    toastError(message);
    if (isExpiredChallenge(message)) {
      onCancel();
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await ensureCsrf();
      const result = await api<VerifyResult>("/api/v1/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: challengeToken, code }),
      });
      onVerified(result.data);
    } catch (err) {
      handleFailure(err instanceof Error ? err.message : t("invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function verifyPasskey() {
    setLoading(true);
    try {
      await ensureCsrf();
      // Fresh options each attempt: a failed assertion consumes the server-side challenge.
      const options = await api<ServerRequestOptions>("/api/v1/auth/mfa/passkey/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: challengeToken }),
      });
      const credential = await getPasskeyAssertion(options);
      const result = await api<VerifyResult>("/api/v1/auth/mfa/passkey/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: challengeToken, credential }),
      });
      onVerified(result.data);
    } catch (err) {
      if (isPasskeyCancelled(err)) {
        toastError(t("passkeyCancelled"));
        return;
      }
      handleFailure(err instanceof Error ? err.message : t("passkeyFailed"));
    } finally {
      setLoading(false);
    }
  }

  const showPasskey = methods.passkey && passkeyCheck === "supported";
  const passkeyUnavailable =
    methods.passkey && (passkeyCheck === "insecure" || passkeyCheck === "unsupported");

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-[var(--muted-foreground)]">
        {totp ? t("mfaDescription") : t("mfaPasskeyDescription")}
      </p>
      {showPasskey ? (
        <div className="space-y-4">
          <Button type="button" className="w-full" disabled={loading} onClick={() => void verifyPasskey()}>
            {t("passkeyButton")}
          </Button>
          <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
            <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
            <span>{t("passkeyDivider")}</span>
            <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
          </div>
        </div>
      ) : null}
      {passkeyUnavailable ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          {passkeyCheck === "insecure" ? t("passkeyNeedsHttps") : t("passkeyUnsupported")}
        </p>
      ) : null}
      <form onSubmit={verifyCode} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="org-mfa-code">{totp ? t("authenticationCode") : t("recoveryCodeLabel")}</Label>
          <Input
            id="org-mfa-code"
            name="code"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? tCommon("verifying") : t("verify")}
        </Button>
      </form>
      <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={onCancel}>
        {tCommon("cancel")}
      </Button>
    </div>
  );
}
