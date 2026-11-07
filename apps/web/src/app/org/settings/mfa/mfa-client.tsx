"use client";

import { FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { api, ensureCsrf } from "@/lib/api";

type Setup = {
  secret: string;
  otpauth_url: string;
  qr_svg: string;
};

function alertVariantForMessage(message: string): "destructive" | "success" | "default" {
  const m = message.toLowerCase();
  if (/\b(fail|failed|error|invalid)\b/.test(m) || m.includes("setup failed") || m.includes("confirm failed")) {
    return "destructive";
  }
  if (m.includes("confirmed")) return "success";
  return "default";
}

export function MfaSetupClient() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function begin() {
    setMessage(null);
    try {
      await ensureCsrf();
      const res = await api<Setup>("/api/v1/auth/mfa/setup", { method: "POST" });
      setSetup(res);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Setup failed");
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      await api("/api/v1/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setMessage("MFA confirmed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Confirm failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="MFA setup"
        description="Scan the QR with an authenticator app, then confirm a code."
        actions={
          <LinkButton href="/org/settings" variant="secondary">
            Settings
          </LinkButton>
        }
      />
      <Button type="button" className="mt-6" onClick={() => void begin()}>
        Generate QR
      </Button>
      {setup ? (
        <div className="mt-8 space-y-4">
          <div
            role="img"
            aria-label="Authenticator QR code"
            className="inline-block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]"
            dangerouslySetInnerHTML={{ __html: setup.qr_svg }}
          />
          <p className="text-sm text-[var(--muted-foreground)] break-all">
            Secret: {setup.secret}
          </p>
          <form onSubmit={confirm} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label htmlFor="mfa-code" className="text-[var(--muted-foreground)]">
                Code
              </Label>
              <Input
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
            <Button type="submit" variant="secondary">
              Confirm
            </Button>
          </form>
        </div>
      ) : null}
      {message ? (
        <Alert className="mt-4" variant={alertVariantForMessage(message)}>
          {message}
        </Alert>
      ) : null}
    </div>
  );
}
