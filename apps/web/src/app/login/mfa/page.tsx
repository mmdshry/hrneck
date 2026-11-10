"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { api, ensureCsrf } from "@/lib/api";
import { resolvePostLoginPath, type SessionUser } from "@/lib/session";
import { setTenant } from "@/lib/tenant";

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

export default function MfaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const challenge = sessionStorage.getItem("mfa_challenge");
    if (!challenge) {
      router.push("/login");
      return;
    }
    setLoading(true);
    try {
      await ensureCsrf();
      const result = await api<{ data?: SessionUser }>("/api/v1/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: challenge, code }),
      });
      sessionStorage.removeItem("mfa_challenge");
      const next = safeNextPath(sessionStorage.getItem("mfa_next"));
      sessionStorage.removeItem("mfa_next");
      const user = result.data;
      if (user?.tenant_id) {
        setTenant(user.tenant_id);
      }
      router.push(user ? resolvePostLoginPath(user, next) : "/org");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid code";
      if (message.toLowerCase().includes("expired") || message.toLowerCase().includes("sign in again")) {
        sessionStorage.removeItem("mfa_challenge");
        sessionStorage.removeItem("mfa_next");
        router.push("/login");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        Multi-factor authentication
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        Enter a 6-digit authenticator code or a one-time recovery code.
      </p>
      <Panel className="mt-8 p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              name="code"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
