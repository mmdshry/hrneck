"use client";

import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import type { SessionUser } from "@/lib/session";

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
  if (m.includes("confirmed") || m.includes("disabled") || m.includes("updated")) return "success";
  return "default";
}

export function MfaSetupClient() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchSessionUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function begin() {
    setMessage(null);
    setRecoveryCodes(null);
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
      const res = await api<{ recovery_codes?: string[] }>("/api/v1/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(Array.isArray(res.recovery_codes) ? res.recovery_codes : []);
      setSetup(null);
      setCode("");
      setMessage("MFA confirmed. Store your recovery codes now — they are shown once.");
      const refreshed = await fetchSessionUser();
      setUser(refreshed);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Confirm failed");
    }
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      await api("/api/v1/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      setDisablePassword("");
      setDisableCode("");
      setRecoveryCodes(null);
      setMessage("MFA disabled.");
      const refreshed = await fetchSessionUser();
      setUser(refreshed);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Disable failed");
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await ensureCsrf();
      await api("/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
          password_confirmation: newPasswordConfirmation,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");
      setMessage("Password updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Password update failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Security"
        description="Manage multi-factor authentication and your password."
        actions={
          <LinkButton href="/org/settings" variant="secondary">
            Settings
          </LinkButton>
        }
      />

      <section className="mt-8 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Multi-factor authentication</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Status: {user?.mfa_enabled ? "Enabled" : "Not enabled"}
        </p>
        {!user?.mfa_enabled ? (
          <Button type="button" onClick={() => void begin()}>
            Generate QR
          </Button>
        ) : null}
        {setup ? (
          <div className="space-y-4">
            <div
              role="img"
              aria-label="Authenticator QR code"
              className="inline-block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-sm)]"
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
        {recoveryCodes && recoveryCodes.length > 0 ? (
          <Alert variant="success">
            <p className="font-medium">Recovery codes (copy now)</p>
            <ul className="mt-2 list-disc pl-5 font-mono text-xs">
              {recoveryCodes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {user?.mfa_enabled ? (
          <form onSubmit={disable} className="mt-4 grid max-w-md gap-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Disable MFA with your password and a TOTP or recovery code.
            </p>
            <div className="space-y-1">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="disable-code">Authenticator or recovery code</Label>
              <Input
                id="disable-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="secondary">
              Disable MFA
            </Button>
          </form>
        ) : null}
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl">Change password</h2>
        <form onSubmit={changePassword} className="grid max-w-md gap-3">
          <div className="space-y-1">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password-confirmation">Confirm new password</Label>
            <Input
              id="new-password-confirmation"
              type="password"
              value={newPasswordConfirmation}
              onChange={(e) => setNewPasswordConfirmation(e.target.value)}
              required
            />
          </div>
          <Button type="submit">Update password</Button>
        </form>
      </section>

      {message ? (
        <Alert className="mt-6" variant={alertVariantForMessage(message)}>
          {message}
        </Alert>
      ) : null}
    </div>
  );
}
