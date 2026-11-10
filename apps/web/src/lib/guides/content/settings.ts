import type { GuideModule } from "@/lib/guides/types";

export const settingsGuide: GuideModule = {
  slug: "settings",
  title: "Settings & delivery",
  summary:
    "Brand the tenant, enforce MFA, confirm SMTP, manage sending profiles, and review custom domain DNS guidance.",
  keywords: [
    "settings",
    "smtp",
    "mfa",
    "branding",
    "sending",
    "domain",
    "integrations",
  ],
  openInAppHref: "/org/settings",
  overview:
    "Settings covers white-label display (name, primary color, logo, timezone), MFA setup for operators, SMTP integration status, outbound sending profiles, and custom sending-domain DNS guidance. Confirm mail before launching campaigns that rely on reminders.",
  example: {
    title: "Go-live mail checklist",
    narrative:
      "Before Q4 launch, DevOps sets display name “Acme Security”, primary color to brand teal, confirms Integrations shows SMTP Connected for mail.hrneck.com, creates sending profile training@notify.acme.test, and follows DNS guidance for the custom domain stub.",
  },
  steps: [
    {
      title: "Open Settings",
      body: "Update display name, color, logo, and timezone for the tenant chrome.",
      href: "/org/settings",
    },
    {
      title: "Enforce MFA",
      body: "Have operators complete MFA setup from Settings → MFA.",
      href: "/org/settings/mfa",
    },
    {
      title: "Verify SMTP",
      body: "Integrations must show Connected before campaign reminders will send reliably.",
      href: "/org/settings/integrations",
    },
    {
      title: "Configure sending profiles",
      body: "Define from-address profiles used by training and notification mail.",
      href: "/org/settings/sending-profiles",
    },
    {
      title: "Review domain DNS guidance",
      body: "Follow the custom sending domain stub when you need branded mail roots.",
    },
  ],
  diagram: {
    title: "Outbound mail readiness",
    nodes: [
      { id: "brand", label: "Branding" },
      { id: "mfa", label: "MFA" },
      { id: "smtp", label: "SMTP status" },
      { id: "profile", label: "Sending profile" },
      { id: "campaign", label: "Campaign mail" },
    ],
    edges: [
      { from: "brand", to: "smtp" },
      { from: "mfa", to: "smtp" },
      { from: "smtp", to: "profile" },
      { from: "profile", to: "campaign" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Settings · Integrations",
    stats: [
      { label: "SMTP", value: "Connected" },
      { label: "MFA", value: "Required" },
      { label: "Profiles", value: "2" },
    ],
    highlight: {
      title: "mail.hrneck.com",
      caption: "Last smoke OK · ready for campaign reminders",
      progress: 100,
    },
    rows: [
      { title: "training@notify.acme.test", meta: "Sending profile · Default" },
      { title: "Primary color", meta: "#083A6D · applied" },
      { title: "Custom domain DNS", meta: "Guidance stub · pending cutover" },
    ],
    annotations: [
      { label: "Integrations", note: "Connected status gates operational confidence." },
      { label: "MFA", note: "Operators verify codes on /login/mfa; disable + recovery codes live under Settings → MFA." },
    ],
  },
  related: ["auth", "training", "getting-started", "users-roles"],
};
