import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { HrneckWordmark } from "@/components/hrneck-wordmark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LinkButton } from "@/components/ui/link-button";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { ThemeToggle } from "@/components/theme-toggle";
import { hostKind, requestHost } from "@/lib/tenant";
import { LoginForm, type LoginScope } from "./login-form";
import { OrgFinder } from "./org-finder";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return {
    title: t("signInTitle"),
    description: t("signInMetaDescription"),
  };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");
  const tLegal = await getTranslations("legal");
  // Sign-in only happens on an organization host or the staff host. The main site helps people find theirs.
  const kind = hostKind(requestHost(await headers()));
  const scope: LoginScope = kind === "platform" ? "platform" : "tenant";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="mb-6 flex items-center justify-end gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <HrneckWordmark className="h-8" />
      <div
        className="mt-6 rounded-[var(--radius)] border border-[var(--border)] border-t-2 bg-[var(--card)] px-6 py-8 shadow-[var(--shadow-sm)]"
        style={{ borderTopColor: "var(--spark)" }}
      >
        {kind === "central" ? (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
              {t("orgFinderTitle")}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {t("orgFinderDescription")}
            </p>
            <OrgFinder />
          </>
        ) : (
          <>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
              {scope === "platform" ? t("staffSignInTitle") : t("signInTitle")}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {scope === "platform" ? t("staffSignInDescription") : t("signInDescription")}
              {process.env.NODE_ENV === "development"
                ? ` Demo: ${scope === "platform" ? "admin@hrneck.test" : "admin@itneck.test"}`
                : null}
            </p>
            <Suspense fallback={<MinimalLoader className="min-h-40 py-10" />}>
              <LoginForm scope={scope} />
            </Suspense>
          </>
        )}
        {kind === "central" ? null : (
          <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
            <LinkButton href="/" variant="link" size="sm">
              {t("backToHome")}
            </LinkButton>
          </p>
        )}
      </div>
      <nav
        aria-label={tLegal("legalLabel")}
        className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm"
      >
        <LinkButton href="/privacy" variant="link" size="sm">
          {tLegal("privacyPolicy")}
        </LinkButton>
        <LinkButton href="/terms" variant="link" size="sm">
          {tLegal("termsOfService")}
        </LinkButton>
      </nav>
    </div>
  );
}
