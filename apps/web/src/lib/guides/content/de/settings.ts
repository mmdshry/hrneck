import type { GuideModule } from "@/lib/guides/types";

export const settingsGuide: GuideModule = {
  slug: "settings",
  title: "Einstellungen & Zustellung",
  summary:
    "Branden Sie den Tenant, erzwingen Sie MFA, bestätigen Sie SMTP, verwalten Sie Sendeprofile und prüfen Sie DNS-Hinweise für benutzerdefinierte Domains.",
  keywords: [
    "einstellungen",
    "smtp",
    "mfa",
    "branding",
    "senden",
    "domain",
    "integrationen",
  ],
  openInAppHref: "/org/settings",
  overview:
    "Einstellungen decken White-Label-Anzeige (Name, Primärfarbe, Logo, Zeitzone), MFA-Einrichtung für Operatoren, SMTP-Integrationsstatus, Outbound-Sendeprofile und DNS-Hinweise für benutzerdefinierte Sendedomains ab. Bestätigen Sie Mail, bevor Sie Kampagnen starten, die auf Erinnerungen angewiesen sind.",
  example: {
    title: "Go-live-Mail-Checkliste",
    narrative:
      "Vor dem Q4-Launch setzt DevOps den Anzeigenamen „Acme Security“, die Primärfarbe auf Marken-Teal, bestätigt, dass Integrationen SMTP Verbunden für mail.hrneck.com zeigt, erstellt das Sendeprofil training@notify.acme.test und folgt den DNS-Hinweisen für den Custom-Domain-Stub.",
  },
  steps: [
    {
      title: "Einstellungen öffnen",
      body: "Aktualisieren Sie Anzeigenamen, Farbe, Logo und Zeitzone für das Tenant-Chrome.",
      href: "/org/settings",
    },
    {
      title: "MFA erzwingen",
      body: "Lassen Sie Operatoren die MFA-Einrichtung unter Einstellungen → MFA abschließen.",
      href: "/org/settings/mfa",
    },
    {
      title: "SMTP prüfen",
      body: "Integrationen müssen Verbunden zeigen, bevor Kampagnenerinnerungen zuverlässig senden.",
      href: "/org/settings/integrations",
    },
    {
      title: "Sendeprofile konfigurieren",
      body: "Definieren Sie Absender-Profile für Schulungs- und Benachrichtigungsmail.",
      href: "/org/settings/sending-profiles",
    },
    {
      title: "Domain-DNS-Hinweise prüfen",
      body: "Folgen Sie dem Custom-Sendedomain-Stub, wenn Sie gebrandete Mail-Roots brauchen.",
    },
  ],
  diagram: {
    title: "Outbound-Mail-Bereitschaft",
    nodes: [
      { id: "brand", label: "Branding" },
      { id: "mfa", label: "MFA" },
      { id: "smtp", label: "SMTP-Status" },
      { id: "profile", label: "Sendeprofil" },
      { id: "campaign", label: "Kampagnenmail" },
    ],
    edges: [
      { from: "brand", to: "smtp" },
      { from: "mfa", to: "smtp" },
      { from: "smtp", to: "profile" },
      { from: "profile", to: "campaign" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Einstellungen · Integrationen",
    stats: [
      { label: "SMTP", value: "Verbunden" },
      { label: "MFA", value: "Erforderlich" },
      { label: "Profile", value: "2" },
    ],
    highlight: {
      title: "mail.hrneck.com",
      caption: "Letzter Smoke OK · bereit für Kampagnenerinnerungen",
      progress: 100,
    },
    rows: [
      { title: "training@notify.acme.test", meta: "Sendeprofil · Standard" },
      { title: "Primärfarbe", meta: "#083A6D · angewendet" },
      { title: "Custom-Domain-DNS", meta: "Hinweis-Stub · Cutover ausstehend" },
    ],
    annotations: [
      { label: "Integrationen", note: "Status Verbunden steuert das operative Vertrauen." },
      { label: "MFA", note: "Operatoren prüfen Codes unter /login/mfa; Deaktivieren + Wiederherstellungscodes liegen unter Einstellungen → MFA." },
    ],
  },
  related: ["auth", "training", "getting-started", "users-roles"],
};
