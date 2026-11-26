"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useBranding } from "@/components/branding-provider";
import { SubscriptionUsageCard } from "@/components/subscription-usage-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { api, ensureCsrf, fetchSessionUser } from "@/lib/api";
import { applyPrimaryColor, isValidHexColor } from "@/lib/branding";
import { hasAnyPermission, hasPermission, type SessionUser } from "@/lib/session";
import { resolveTenant } from "@/lib/tenant";
import { toastError, toastSuccess } from "@/lib/toast";
import { DnsGuidanceDialog, type Guidance } from "./dns-guidance-dialog";
import { WebhookTestDialog } from "./webhook-test-dialog";

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

const ACCOUNT_LINK_HREFS = ["/org/settings/mfa"] as const;

const ADMIN_LINK_HREFS = [
  "/org/settings/sending-profiles",
  "/org/settings/integrations",
  "/org/settings/mfa",
] as const;

export function SettingsClient() {
  const t = useTranslations("org.settings");
  const tCommon = useTranslations("common");
  const { logoUrl, refresh: refreshBranding } = useBranding();

  const [session, setSession] = useState<SessionUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#083a6d");
  const [timezone, setTimezone] = useState("UTC");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [sendingDomain, setSendingDomain] = useState("");
  const [guidance, setGuidance] = useState<Guidance | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dnsOpen, setDnsOpen] = useState(false);
  const [webhookTestOpen, setWebhookTestOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await ensureCsrf();
        const me = await fetchSessionUser();
        setSession(me);
        if (!me || !hasAnyPermission(me, ["org.settings.view", "org.settings.manage"])) {
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
          setPrimaryColor(row.primary_color ?? "#083a6d");
          setTimezone(row.timezone ?? "UTC");
          setSendingDomain(row.meta?.sending_domain ?? "");
          setWebhookUrl(row.meta?.webhook_url ?? "");
        }
        setGuidance(domains.data.guidance);
      } catch (err) {
        toastError(err instanceof Error ? err.message : tCommon("loadFailed"));
      } finally {
        setLoaded(true);
      }
    })();
  }, [tCommon]);

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
          timezone: timezone.trim() || "UTC",
          sending_domain: sendingDomain,
          webhook_url: webhookUrl.trim() || null,
        }),
      });
      const row = saved.data;
      if (row) {
        setDisplayName(row.display_name ?? "");
        setPrimaryColor(row.primary_color ?? "#083a6d");
        setTimezone(row.timezone ?? "UTC");
        setSendingDomain(row.meta?.sending_domain ?? "");
        setWebhookUrl(row.meta?.webhook_url ?? "");
        applyPrimaryColor(row.primary_color);
      }
      const domains = await api<{ data: { guidance: Guidance | null } }>(
        "/api/v1/org/domains",
        { tenant },
      );
      setGuidance(domains.data.guidance);
      await refreshBranding();
      toastSuccess(t("whiteLabelSaved"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : tCommon("saveFailed"));
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
      toastSuccess(t("logoUploaded"));
    } catch (err) {
      toastError(err instanceof Error ? err.message : t("logoUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  if (!loaded) {
    return <PageSkeleton className="max-w-3xl" variant="form" rows={6} />;
  }

  const canManageSettings = hasPermission(session, "org.settings.manage");
  const canViewSettings = hasAnyPermission(session, [
    "org.settings.view",
    "org.settings.manage",
  ]);

  const accountLinks = ACCOUNT_LINK_HREFS.map((href) => ({
    href,
    label: t("accountMfa"),
  }));
  const adminLinks = ADMIN_LINK_HREFS.map((href) => ({
    href,
    label:
      href.includes("sending-profiles")
        ? t("sendingProfiles")
        : href.includes("integrations")
          ? t("integrations")
          : t("accountMfa"),
  }));

  if (session && !canViewSettings) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <PageHeader
          title={t("title")}
          description={t("limitedAccessDescription")}
        />
        <nav className="flex flex-wrap gap-2" aria-label={t("accountSettingsAria")}>
          {accountLinks.map((link) => (
            <LinkButton key={link.href} href={link.href} variant="secondary" size="sm">
              {link.label}
            </LinkButton>
          ))}
        </nav>
        <EmptyState title={t("needManagePermission")} />
      </div>
    );
  }

  const previewColor = isValidHexColor(primaryColor) ? primaryColor : "#083a6d";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("settingsLinksAria")}>
        {adminLinks.map((link) => (
          <LinkButton key={link.href} href={link.href} variant="secondary" size="sm">
            {link.label}
          </LinkButton>
        ))}
      </nav>
      <SubscriptionUsageCard subscription={session?.subscription} />
      <fieldset disabled={!canManageSettings} className="contents">
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="settings-display-name" className="text-[var(--muted-foreground)]">
              {t("displayName")}
            </Label>
            <Input
              id="settings-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-primary-color" className="text-[var(--muted-foreground)]">
              {t("primaryColor")}
            </Label>
            <p className="text-sm text-[var(--muted-foreground)]">{t("primaryColorHint")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                aria-label={t("pickPrimaryColor")}
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
                {t("preview")}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-logo" className="text-[var(--muted-foreground)]">
              {t("companyLogo")}
            </Label>
            <div className="flex flex-wrap items-center gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={t("currentLogoAlt")}
                  className="h-12 w-12 rounded-lg border border-[var(--border)] object-contain"
                />
              ) : (
                <span className="text-sm text-[var(--muted-foreground)]">{t("noLogoUploaded")}</span>
              )}
              <Input
                id="settings-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={uploading}
                onChange={(e) => void onLogoChange(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-timezone" className="text-[var(--muted-foreground)]">
              {t("timezone")}
            </Label>
            <TimezoneSelect
              id="settings-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-webhook-url" className="text-[var(--muted-foreground)]">
              {t("webhookUrl")}
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="settings-webhook-url"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/hooks/hrneck"
                className="min-w-[16rem] flex-1"
              />
              <Button type="button" variant="secondary" onClick={() => setWebhookTestOpen(true)}>
                {t("testWebhook")}
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="settings-sending-domain" className="text-[var(--muted-foreground)]">
              {t("sendingDomain")}
            </Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="settings-sending-domain"
                value={sendingDomain}
                onChange={(e) => setSendingDomain(e.target.value)}
                className="min-w-[16rem] flex-1"
              />
            </div>
          </div>
          <Button type="submit">{t("saveSettings")}</Button>
        </form>
      </fieldset>
      {guidance ? (
        <>
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setDnsOpen(true)}>
              {t("dnsRecords")}
            </Button>
          </div>
          <DnsGuidanceDialog open={dnsOpen} onOpenChange={setDnsOpen} guidance={guidance} />
        </>
      ) : null}
      <WebhookTestDialog
        open={webhookTestOpen}
        onOpenChange={setWebhookTestOpen}
        url={webhookUrl}
      />
    </div>
  );
}
