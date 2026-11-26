"use client";

import { Suspense, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { isAppLocale, normalizeLocale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/set-locale";
import { api, ensureCsrf } from "@/lib/api";
import { resolvePostLoginPath, type SessionUser } from "@/lib/session";
import { safeNextPath, ssoLoginErrorPath } from "@/lib/sso";
import { setTenant } from "@/lib/tenant";

function SsoCompleteContent() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The handoff token is single-use. StrictMode runs effects twice in development, so guard the exchange.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    const token = searchParams.get("token");
    if (!token) {
      router.replace(ssoLoginErrorPath("handoff_invalid"));
      return;
    }

    void (async () => {
      try {
        await ensureCsrf();
        const result = await api<{ data?: SessionUser; next?: string | null }>(
          "/api/v1/auth/oauth/exchange",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );

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

        const next = safeNextPath(result.next ?? null);
        router.replace(user ? resolvePostLoginPath(user, next) : "/org");
      } catch {
        router.replace(ssoLoginErrorPath("handoff_invalid"));
      }
    })();
  }, [searchParams, router, locale]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
      <MinimalLoader className="min-h-40 py-10" />
      <p className="text-sm text-[var(--muted-foreground)]">{t("ssoCompleting")}</p>
    </div>
  );
}

export default function SsoCompletePage() {
  return (
    <Suspense fallback={<MinimalLoader className="min-h-40 py-10" />}>
      <SsoCompleteContent />
    </Suspense>
  );
}
