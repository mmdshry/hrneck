"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAppLocale, normalizeLocale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/set-locale";
import { api, ensureCsrf } from "@/lib/api";
import { resolvePostLoginPath, type SessionUser } from "@/lib/session";
import {
  isSsoErrorCode,
  isSsoProvider,
  safeNextPath,
  ssoErrorMessageKey,
  ssoStartUrl,
  type SsoProvider,
} from "@/lib/sso";
import { setTenant, tenantFromHostname } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import { GoogleIcon, MicrosoftIcon } from "./sso-provider-icons";

const isDev = process.env.NODE_ENV === "development";

export function LoginForm() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(isDev ? "admin@hrneck.test" : "");
  const [password, setPassword] = useState(isDev ? "DemoPass!234" : "");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([]);
  const ssoErrorShown = useRef(false);
  const showGoogle = ssoProviders.includes("google");
  const showMicrosoft = ssoProviders.includes("microsoft");

  // Only providers with credentials on the server get a button. Until the list loads, password sign-in alone is shown.
  useEffect(() => {
    let active = true;
    api<{ data?: string[] }>("/api/v1/auth/oauth/providers")
      .then((result) => {
        if (active) {
          setSsoProviders((result.data ?? []).filter(isSsoProvider));
        }
      })
      .catch(() => {
        // If the list cannot be loaded, password sign-in remains available.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const code = searchParams.get("sso_error");
    if (ssoErrorShown.current || !isSsoErrorCode(code)) {
      return;
    }
    ssoErrorShown.current = true;
    toastError(t(ssoErrorMessageKey(code)));

    const params = new URLSearchParams(searchParams.toString());
    params.delete("sso_error");
    const query = params.toString();
    router.replace(query ? `/login?${query}` : "/login");
  }, [searchParams, router, t]);

  // A full navigation: the API redirects to the identity provider, so this cannot be a client-side route.
  function startSso(provider: SsoProvider) {
    window.location.assign(
      ssoStartUrl(provider, {
        returnTo: window.location.origin,
        next: safeNextPath(searchParams.get("next")),
        remember,
      }),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await ensureCsrf();
      const result = await api<{
        mfa_required?: boolean;
        challenge_token?: string;
        mfa_methods?: { totp: boolean; passkey: boolean };
        data?: SessionUser;
      }>("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The organization address (subdomain or ?tenant=) picks this organization's login when one email has several.
        body: JSON.stringify({
          email,
          password,
          remember,
          tenant: tenantFromHostname(window.location.hostname) ?? searchParams.get("tenant") ?? undefined,
        }),
      });

      const next = safeNextPath(searchParams.get("next"));

      if (result.mfa_required && result.challenge_token) {
        sessionStorage.setItem("mfa_challenge", result.challenge_token);
        if (result.mfa_methods) {
          sessionStorage.setItem("mfa_methods", JSON.stringify(result.mfa_methods));
        } else {
          sessionStorage.removeItem("mfa_methods");
        }
        if (next) {
          sessionStorage.setItem("mfa_next", next);
        } else {
          sessionStorage.removeItem("mfa_next");
        }
        router.push("/login/mfa");
        return;
      }

      const user = result.data;
      if (user && !user.needs_org_selection && user.tenant_id) {
        setTenant(user.tenant_id);
      }
      if (
        user?.locale &&
        isAppLocale(user.locale) &&
        user.locale !== normalizeLocale(locale)
      ) {
        await setLocaleCookie(user.locale);
      }
      router.push(user ? resolvePostLoginPath(user, next) : "/org");
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {showGoogle || showMicrosoft ? (
        <>
          <div className="space-y-3">
            {showGoogle ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => startSso("google")}
              >
                <GoogleIcon />
                {t("continueWithGoogle")}
              </Button>
            ) : null}
            {showMicrosoft ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => startSso("microsoft")}
              >
                <MicrosoftIcon />
                {t("continueWithMicrosoft")}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
            <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
            <span>{t("orSignInWithPassword")}</span>
            <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
          </div>
        </>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-[var(--space-sm)] text-sm text-[var(--muted-foreground)]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-5 w-5 shrink-0 rounded border-[var(--border)]"
        />
        {t("rememberMe")}
      </label>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? tCommon("signingIn") : t("continue")}
      </Button>
      <p className="text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/login/forgot" className="underline-offset-4 hover:underline">
          {t("forgotPasswordLink")}
        </Link>
      </p>
    </form>
  );
}
