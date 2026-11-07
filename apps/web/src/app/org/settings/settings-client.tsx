"use client";

import { FormEvent, useEffect, useState } from "react";
import { useBranding } from "@/components/branding-provider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { applyPrimaryColor, isValidHexColor } from "@/lib/branding";
import { hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { notifyResult, toastError, toastSuccess } from "@/lib/toast";

type Guidance = {
  domain: string;
  records: { type: string; host: string; value: string; purpose: string }[];
};

type OrgSettings = {
  display_name?: string | null;
  primary_color?: string | null;
  timezone?: string | null;
  logo_path?: string | null;
  meta?: {
    sending_domain?: string | null;
    webhook_url?: string | null;
  } | null;
};

const LINKS = [
  { href: "/org/settings/sending-profiles", label: "Sending profiles" },
  { href: "/org/settings/integrations", label: "Integrations" },
  { href: "/org/settings/mfa", label: "MFA setup" },
];

export function SettingsClient() {
  const { logoUrl, refresh: refreshBranding } = useBranding();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [sendingDomain, setSendingDomain] = useState("");
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        setSession(me);
        if (!me || !hasPermission(me, "org.settings.manage")) {
          setLoaded(true);
          return;
        }
        const tenant = resolveTenant();
        const [settings, domains] = await Promise.all([
          api<{ data: OrgSettings | null }>("/api/v1/org/settings", { tenant }),
          api<{ data: { guidance: Guidance | null } }>("/api/v1/org/domains", { tenant }),
        ]);
        const row = settings.data;
        if (row) {
          setDisplayName(row.display_name ?? "");
          setPrimaryColor(row.primary_color ?? "#0f766e");
          setSendingDomain(row.meta?.sending_domain ?? "");
        }
        setGuidance(domains.data.guidance);
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Load failed");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      const saved = await api<{ data: OrgSettings | null }>("/api/v1/org/settings", {
        method: "PUT",
        tenant,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          primary_color: primaryColor,
          sending_domain: sendingDomain,
        }),
      });
      const row = saved.data;
      if (row) {
        setDisplayName(row.display_name ?? "");
        setPrimaryColor(row.primary_color ?? "#0f766e");
        setSendingDomain(row.meta?.sending_domain ?? "");
        applyPrimaryColor(row.primary_color);
      }
      const domains = await api<{ data: { guidance: Guidance | null } }>(
        "/api/v1/org/domains",
        { tenant },
      );
      setGuidance(domains.data.guidance);
      await refreshBranding();
      toastSuccess("White-label and sending domain saved.");
    } catch (err) {
      notifyResult(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onLogoChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      await ensureCsrf();
      const tenant = resolveTenant();
      const body = new FormData();
      body.append("file", file);
      await api("/api/v1/org/settings/logo", {
        method: "POST",
        tenant,
        body,
      });
      await refreshBranding();
      toastSuccess("Company logo uploaded.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!loaded) {
    return <PageSkeleton className="max-w-3xl" variant="form" rows={6} />;
  }

  if (session && !hasPermission(session, "org.settings.manage")) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader
          title="Organization settings"
          description="White-label branding, domains, and related setup pages."
        />
        <Alert>You need org.settings.manage to change organization settings.</Alert>
      </div>
    );
  }

  const previewColor = isValidHexColor(primaryColor) ? primaryColor : "#0f766e";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Organization settings"
        description="White-label branding, domains, and related setup pages."
      />
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Settings links">
        {LINKS.map((link) => (
          <LinkButton key={link.href} href={link.href} variant="secondary" size="sm">
            {link.label}
          </LinkButton>
        ))}
      </nav>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="settings-display-name" className="text-[var(--muted-foreground)]">
            Display name
          </Label>
          <Input
            id="settings-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="settings-primary-color" className="text-[var(--muted-foreground)]">
            Primary color
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              aria-label="Pick primary color"
              value={previewColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                applyPrimaryColor(e.target.value);
              }}
              className="h-10 w-12 cursor-pointer rounded border border-[var(--border)] bg-transparent p-1"
            />
            <Input
              id="settings-primary-color"
              value={primaryColor}
              onChange={(e) => {
                setPrimaryColor(e.target.value);
                if (isValidHexColor(e.target.value)) {
                  applyPrimaryColor(e.target.value);
                }
              }}
              className="max-w-[10rem]"
            />
            <span
              className="inline-flex h-9 items-center rounded-md px-3 text-sm text-white"
              style={{ backgroundColor: previewColor }}
            >
              Preview
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-logo" className="text-[var(--muted-foreground)]">
            Company logo
          </Label>
          <div className="flex flex-wrap items-center gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Current company logo"
                className="h-12 w-12 rounded-lg border border-[var(--border)] object-contain"
              />
            ) : (
              <span className="text-sm text-[var(--muted-foreground)]">No logo uploaded</span>
            )}
            <Input
              id="settings-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={uploading}
              onChange={(e) => void onLogoChange(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="settings-sending-domain" className="text-[var(--muted-foreground)]">
            Sending domain
          </Label>
          <Input
            id="settings-sending-domain"
            value={sendingDomain}
            onChange={(e) => setSendingDomain(e.target.value)}
          />
        </div>
        <Button type="submit">Save settings</Button>
      </form>
      {guidance ? (
        <section className="mt-10" aria-label="DNS guidance">
          <h2 className="text-xl font-medium text-[var(--foreground)]">DNS for {guidance.domain}</h2>
          {guidance.records.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No DNS records"
              description="Guidance will appear when records are available from the API."
            />
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {guidance.records.map((record) => (
                <li key={`${record.type}-${record.host}`} className="py-3 text-sm">
                  <p className="font-medium">
                    {record.type} {record.host}
                  </p>
                  <p className="text-[var(--muted-foreground)]">{record.value}</p>
                  <p className="mt-1 text-[var(--muted-foreground)]">{record.purpose}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
