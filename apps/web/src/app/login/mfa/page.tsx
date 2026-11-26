"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { useClientSnapshot } from "@/hooks/use-client-snapshot";
import { api, ensureCsrf } from "@/lib/api";
import { resolvePostLoginPath, type SessionUser } from "@/lib/session";
import { setTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import {
  checkPasskeySupport,
  getPasskeyAssertion,
  isPasskeyCancelled,
  type PasskeyCheck,
  type ServerRequestOptions,
} from "@/lib/webauthn";

type MfaMethods = { totp: boolean; passkey: boolean };

type VerifyResult = { data?: SessionUser };

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

/** Older sessions stored no methods; a bare challenge always meant an authenticator code. */
function parseMfaMethods(raw: string | null): MfaMethods {
  const fallback: MfaMethods = { totp: true, passkey: false };
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MfaMethods>;

    return { totp: Boolean(parsed.totp), passkey: Boolean(parsed.passkey) };
  } catch {
    return fallback;
  }
}

export default function MfaPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const storedMethods = useClientSnapshot<string | null>(
    () => sessionStorage.getItem("mfa_methods"),
    () => null,
  );
  const passkeyCheck = useClientSnapshot<PasskeyCheck>(
    checkPasskeySupport,
    () => "pending",
  );
  const methods = parseMfaMethods(storedMethods);

  function clearChallenge() {
    sessionStorage.removeItem("mfa_challenge");
    sessionStorage.removeItem("mfa_methods");
    sessionStorage.removeItem("mfa_next");
  }

  function completeSignIn(result: VerifyResult) {
    sessionStorage.removeItem("mfa_challenge");
    sessionStorage.removeItem("mfa_methods");
    const next = safeNextPath(sessionStorage.getItem("mfa_next"));
    sessionStorage.removeItem("mfa_next");
    const user = result.data;
    if (user && !user.needs_org_selection && user.tenant_id) {
      setTenant(user.tenant_id);
    }
    router.push(user ? resolvePostLoginPath(user, next) : "/org");
  }

  function handleFailure(message: string) {
    if (
      message.toLowerCase().includes("expired") ||
      message.toLowerCase().includes("sign in again")
    ) {
      clearChallenge();
      router.push("/login");
      return;
    }
    toastError(message);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const challenge = sessionStorage.getItem("mfa_challenge");
    if (!challenge) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      await ensureCsrf();
      const result = await api<VerifyResult>("/api/v1/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: challenge, code }),
      });
      completeSignIn(result);
    } catch (err) {
      handleFailure(err instanceof Error ? err.message : t("invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  async function onPasskey() {
    const challenge = sessionStorage.getItem("mfa_challenge");
    if (!challenge) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      await ensureCsrf();
      // Fresh options each attempt: a failed assertion consumes the server-side challenge.
      const options = await api<ServerRequestOptions>(
        "/api/v1/auth/mfa/passkey/options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge_token: challenge }),
        },
      );
      const credential = await getPasskeyAssertion(options);
      const result = await api<VerifyResult>(
        "/api/v1/auth/mfa/passkey/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge_token: challenge, credential }),
        },
      );
      completeSignIn(result);
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

  const totp = methods.totp;
  const showPasskeyOption = methods.passkey;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {t("mfaTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {totp ? t("mfaDescription") : t("mfaPasskeyDescription")}
      </p>
      <Panel className="mt-8 p-6">
        {showPasskeyOption && passkeyCheck === "supported" ? (
          <div className="mb-6 space-y-4">
            <Button
              type="button"
              className="w-full"
              disabled={loading}
              onClick={() => void onPasskey()}
            >
              {t("passkeyButton")}
            </Button>
            <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
              <span
                className="h-px flex-1 bg-[var(--border)]"
                aria-hidden="true"
              />
              <span>{t("passkeyDivider")}</span>
              <span
                className="h-px flex-1 bg-[var(--border)]"
                aria-hidden="true"
              />
            </div>
          </div>
        ) : null}
        {showPasskeyOption &&
        (passkeyCheck === "insecure" || passkeyCheck === "unsupported") ? (
          <p className="mb-6 text-sm text-[var(--muted-foreground)]">
            {passkeyCheck === "insecure"
              ? t("passkeyNeedsHttps")
              : t("passkeyUnsupported")}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">
              {totp ? t("authenticationCode") : t("recoveryCodeLabel")}
            </Label>
            <Input
              id="code"
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
      </Panel>
    </div>
  );
}
