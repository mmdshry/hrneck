"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf } from "@/lib/api";
import { defaultPostLoginPath, type SessionUser } from "@/lib/session";
import { setTenant } from "@/lib/tenant";

const isDev = process.env.NODE_ENV === "development";

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(isDev ? "admin@hrneck.test" : "");
  const [password, setPassword] = useState(isDev ? "DemoPass!234" : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await ensureCsrf();
      const result = await api<{
        mfa_required?: boolean;
        challenge_token?: string;
        data?: SessionUser;
      }>("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (result.mfa_required && result.challenge_token) {
        sessionStorage.setItem("mfa_challenge", result.challenge_token);
        router.push("/login/mfa");
        return;
      }

      const user = result.data;
      if (user?.tenant_id) {
        setTenant(user.tenant_id);
      }
      const next = safeNextPath(searchParams.get("next"));
      router.push(next ?? (user ? defaultPostLoginPath(user) : "/org"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel className="mt-8 p-6">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
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
          <Label htmlFor="password">Password</Label>
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
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Continue"}
        </Button>
        {isDev ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Dev: org admin <code>admin@itneck.test</code>, platform{" "}
            <code>admin@hrneck.test</code>
          </p>
        ) : null}
      </form>
    </Panel>
  );
}
