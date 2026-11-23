"use client";

import { FormEvent, useState } from "react";
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
import { setTenant } from "@/lib/tenant";
import { toastError } from "@/lib/toast";

const isDev = process.env.NODE_ENV === "development";

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await ensureCsrf();
      const result = await api<{
        mfa_required?: boolean;
        challenge_token?: string;
        data?: SessionUser;
      }>("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });

      const next = safeNextPath(searchParams.get("next"));

      if (result.mfa_required && result.challenge_token) {
        sessionStorage.setItem("mfa_challenge", result.challenge_token);
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
      {isDev ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Dev: org admin <code>admin@itneck.test</code>, platform{" "}
          <code>admin@hrneck.test</code>
        </p>
      ) : null}
    </form>
  );
}
