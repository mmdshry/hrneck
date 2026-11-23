"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await ensureCsrf();
      const res = await api<{ message?: string }>("/api/v1/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toastSuccess(res.message ?? t("resetSent"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("requestFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {t("forgotTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {t("forgotDescription")}
      </p>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? tCommon("sending") : t("sendResetLink")}
          </Button>
        </form>
      </Panel>
      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/login" className="underline-offset-4 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
