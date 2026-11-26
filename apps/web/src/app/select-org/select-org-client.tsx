"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { useClientSnapshot } from "@/hooks/use-client-snapshot";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { clearOrgChoice, parseOrgChoice, readStoredOrgChoice } from "@/lib/org-choice";
import {
  resolvePostLoginPath,
  signInOrganizations,
  type SessionUser,
  type SignInOrganization,
} from "@/lib/session";
import { setTenant, tenantWorkspaceUrl } from "@/lib/tenant";
import { toastError } from "@/lib/toast";
import { OrgMfaStep, type MfaMethods } from "./org-mfa-step";

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

/** Absolute URL of the organization's own subdomain, on the page this user should land on. */
function organizationEntryUrl(tenantId: string, session: SessionUser | undefined, next: string | null): string {
  const path = session
    ? resolvePostLoginPath({ ...session, needs_org_selection: false }, next)
    : "/org";
  return tenantWorkspaceUrl(tenantId, path);
}

type SignInResult = {
  data?: SessionUser;
  mfa_required?: boolean;
  challenge_token?: string;
  mfa_methods?: MfaMethods;
};

type PendingMfa = {
  tenantId: string;
  challengeToken: string;
  methods: MfaMethods;
};

/**
 * Two ways into this page:
 * - An org choice (a password matched several organization logins): pick one, no password asked again.
 * - A signed-in login: memberships enter directly, and another login's organization asks for its password.
 */
export function SelectOrgClient() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  // undefined during SSR and hydration, then the stored value (null when there is none).
  const storedChoice = useClientSnapshot<string | null | undefined>(readStoredOrgChoice, () => undefined);
  const choice = useMemo(() => parseOrgChoice(storedChoice ?? null), [storedChoice]);
  const awaitingBrowser = storedChoice === undefined;
  const hasPendingChoice = choice !== null;

  const [user, setUser] = useState<SessionUser | null>(null);
  const [organizations, setOrganizations] = useState<SignInOrganization[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyTenant, setBusyTenant] = useState<string | null>(null);
  const [passwordTenant, setPasswordTenant] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);

  useEffect(() => {
    // Decided once, at mount, from storage itself. The render snapshot is re-read on every render, and a
    // stored choice cleared mid-flow must not start a session lookup that would send the user to /login.
    if (awaitingBrowser || parseOrgChoice(readStoredOrgChoice())) {
      return;
    }
    void fetchSessionUser()
      .then((session) => {
        if (!session) {
          router.replace("/login");
          return;
        }
        if (session.is_platform_staff) {
          router.replace("/msp");
          return;
        }
        const list = signInOrganizations(session);
        if (list.length === 1 && !list[0].requires_password && !session.needs_org_selection) {
          setTenant(list[0].tenant_id);
          window.location.assign(organizationEntryUrl(list[0].tenant_id, session, next));
          return;
        }
        if (list.length === 0) {
          toastError(t("selectOrgEmpty"));
        }
        setUser(session);
        setOrganizations(list);
        setLoaded(true);
      })
      .catch((err) => {
        toastError(err instanceof Error ? err.message : t("selectOrgLoadFailed"));
        setLoaded(true);
      });
  }, [awaitingBrowser, router, next, t]);

  /** Full navigation to the organization's own subdomain, so the tenant host is the one in the address bar. */
  function goToOrganization(tenantId: string, session: SessionUser | undefined) {
    setTenant(tenantId);
    window.location.assign(organizationEntryUrl(tenantId, session, next));
  }

  function showFailure(err: unknown) {
    toastError(err instanceof Error ? err.message : t("selectOrgEnterFailed"));
  }

  async function enterOwnOrganization(tenantId: string) {
    setBusyTenant(tenantId);
    try {
      await ensureCsrf();
      const result = await api<{ data?: SessionUser }>(
        `/api/v1/auth/orgs/${encodeURIComponent(tenantId)}/enter`,
        { method: "POST" },
      );
      goToOrganization(tenantId, result.data);
    } catch (err) {
      showFailure(err);
      setBusyTenant(null);
    }
  }

  async function switchToOrganization(tenantId: string, event: FormEvent) {
    event.preventDefault();
    setBusyTenant(tenantId);
    try {
      await ensureCsrf();
      const result = await api<SignInResult>(
        `/api/v1/auth/orgs/${encodeURIComponent(tenantId)}/switch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      setPassword("");
      if (result.mfa_required && result.challenge_token) {
        setPendingMfa({
          tenantId,
          challengeToken: result.challenge_token,
          methods: result.mfa_methods ?? { totp: true, passkey: false },
        });
        setBusyTenant(null);
        return;
      }
      goToOrganization(tenantId, result.data);
    } catch (err) {
      showFailure(err);
      setBusyTenant(null);
    }
  }

  async function chooseOrganization(tenantId: string) {
    if (!choice) {
      return;
    }
    setBusyTenant(tenantId);
    try {
      await ensureCsrf();
      const result = await api<SignInResult>("/api/v1/auth/login/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_token: choice.challengeToken, tenant: tenantId }),
      });
      if (result.mfa_required && result.challenge_token) {
        // The stored choice stays until the flow ends, so this page keeps its mode while the code is entered.
        setPendingMfa({
          tenantId,
          challengeToken: result.challenge_token,
          methods: result.mfa_methods ?? { totp: true, passkey: false },
        });
        setBusyTenant(null);
        return;
      }
      clearOrgChoice();
      goToOrganization(tenantId, result.data);
    } catch (err) {
      // The choice expires or was already used: start over from the sign-in form.
      clearOrgChoice();
      showFailure(err);
      router.replace("/login");
    }
  }

  function onOrganizationAction(org: SignInOrganization) {
    if (choice) {
      void chooseOrganization(org.tenant_id);
      return;
    }
    if (org.requires_password) {
      setPassword("");
      setPasswordTenant(passwordTenant === org.tenant_id ? null : org.tenant_id);
      return;
    }
    void enterOwnOrganization(org.tenant_id);
  }

  function onMfaVerified(session: SessionUser | undefined) {
    if (!pendingMfa) {
      return;
    }
    clearOrgChoice();
    goToOrganization(pendingMfa.tenantId, session);
  }

  function onMfaCancelled() {
    if (choice) {
      // The choice token was spent on the org pick, so the only way back is a fresh sign-in.
      clearOrgChoice();
      router.replace("/login");
      return;
    }
    setPendingMfa(null);
  }

  const listed: SignInOrganization[] = choice
    ? choice.organizations.map((org) => ({ ...org, requires_password: false }))
    : organizations;
  const loading = awaitingBrowser || (!hasPendingChoice && !loaded);

  return (
    <div
      className="mt-6 rounded-[var(--radius)] border border-[var(--border)] border-t-2 bg-[var(--card)] px-6 py-8 shadow-[var(--shadow-sm)]"
      style={{ borderTopColor: "var(--spark)" }}
    >
      <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
        {t("selectOrgTitle")}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {t("selectOrgDescription")}
      </p>
      {pendingMfa ? (
        <OrgMfaStep
          challengeToken={pendingMfa.challengeToken}
          methods={pendingMfa.methods}
          onVerified={onMfaVerified}
          onCancel={onMfaCancelled}
        />
      ) : loading ? (
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">{tCommon("loading")}</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {listed.map((org) => {
            const isCurrent = user?.active_tenant_id === org.tenant_id;
            const busy = busyTenant === org.tenant_id;
            return (
              <li key={org.tenant_id}>
                <Panel className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--foreground)]">
                        {org.name || org.tenant_id}
                        {isCurrent ? (
                          <span className="ms-2 text-xs font-normal text-[var(--muted-foreground)]">
                            {t("selectOrgCurrent")}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {org.tenant_id}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyTenant !== null}
                      onClick={() => onOrganizationAction(org)}
                    >
                      {busy ? tCommon("opening") : t("selectOrgContinue")}
                    </Button>
                  </div>
                  {!choice && passwordTenant === org.tenant_id ? (
                    <form
                      onSubmit={(event) => void switchToOrganization(org.tenant_id, event)}
                      className="mt-4 space-y-3"
                    >
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {t("selectOrgPasswordPrompt")}
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor={`org-password-${org.tenant_id}`}>{t("password")}</Label>
                        <Input
                          id={`org-password-${org.tenant_id}`}
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={busyTenant !== null}>
                        {busy ? tCommon("opening") : t("continue")}
                      </Button>
                    </form>
                  ) : null}
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        <Link href="/login" className="underline-offset-4 hover:underline">
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
