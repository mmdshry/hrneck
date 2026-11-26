"use client";

import { FormEvent, Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf } from "@/lib/api";
import { toastError } from "@/lib/toast";

function ResetPasswordForm({ isInvite }: { isInvite: boolean }) {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const token = searchParams.get("token") ?? "";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (!token) {
        throw new Error(t("resetTokenMissing"));
      }
      await ensureCsrf();
      await api("/api/v1/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          // The link names the organization whose login this token belongs to.
          tenant: searchParams.get("tenant") ?? undefined,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      router.push("/login");
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("resetFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="mt-8 p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("newPassword")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password_confirmation">{t("confirmPassword")}</Label>
          <Input
            id="password_confirmation"
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading || !token}>
          {loading ? tCommon("saving") : isInvite ? t("inviteSubmit") : t("resetPassword")}
        </Button>
      </form>
    </Panel>
  );
}

// Invite links (`invite=1`) come from the employee invite email and open the same page with set-password copy.
function ResetPasswordContent() {
  const t = useTranslations("auth");
  const isInvite = useSearchParams().get("invite") === "1";

  return (
    <>
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {isInvite ? t("inviteTitle") : t("resetTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {isInvite ? t("inviteDescription") : t("resetDescription")}
      </p>
      <ResetPasswordForm isInvite={isInvite} />
    </>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Suspense fallback={<MinimalLoader className="min-h-40 py-10" />}>
        <ResetPasswordContent />
      </Suspense>
      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/login" className="underline-offset-4 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
