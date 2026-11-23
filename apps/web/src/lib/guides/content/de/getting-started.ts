import type { GuideModule } from "@/lib/guides/types";

export const gettingStartedGuide: GuideModule = {
  slug: "getting-started",
  title: "Erste Schritte",
  summary:
    "Melden Sie sich als Organisationsadministrator an, lernen Sie die Tenant-Shell kennen und folgen Sie dem empfohlenen Pfad für die erste Woche.",
  keywords: ["onboarding", "login", "demo", "rollen", "hosts", "start"],
  openInAppHref: "/org",
  overview:
    "HRNECK-Tenant-Arbeitsbereiche laufen unter {slug}.hrneck.test (oder dem Alias app.hrneck.test). Organisationsadministratoren nutzen die linke Seitenleiste, um Schulung, Mitarbeitende, Checklisten, Ticketing, Berichte, Benutzer und Einstellungen zu verwalten. Guides bleiben öffentlich, damit Sie Workflows vor der Anmeldung prüfen können.",
  example: {
    title: "Acme Corp Erstanmeldung",
    narrative:
      "Sara (org_admin@acme.test) öffnet acme.hrneck.test, meldet sich mit ihrem MFA-geschützten Konto an, landet im Organisations-Dashboard und nutzt Guides, um SMTP und Mitarbeitende zu bestätigen, bevor sie die Q4-Awareness-Kampagne startet.",
  },
  steps: [
    {
      title: "Öffnen Sie Ihren Tenant-Host",
      body: "Nutzen Sie {slug}.hrneck.test für Ihre Organisation. Lokale Demo-Tenants umfassen itneck, test und company.",
    },
    {
      title: "Als Organisationsadministrator anmelden",
      body: "Verwenden Sie ein org_admin-Konto wie admin@{tenant}.test. Plattform-Mitarbeiter (admin@hrneck.test) nutzen MSP → Tenant-Admin öffnen, was vor dem Laden von /org einen echten Staff-Tenant-Kontext setzt.",
      href: "/login",
    },
    {
      title: "Seitenleiste prüfen",
      body: "Dashboard, Schulung, Checklisten, Ticketing, Mitarbeitende, Abteilungen, Gruppen, Benutzer, Rollen, Berichte, Ankündigungen und Einstellungen entsprechen 1:1 den Tenant-Funktionen.",
    },
    {
      title: "Dem Startpfad folgen",
      body: "Mitarbeitende mit dem CSV-Mapping-Assistenten importieren → SMTP prüfen → Onboarding-Packs/Checklisten verbinden → Schulungskampagne zuweisen → Berichte öffnen. Jeder Schritt hat einen eigenen Guide.",
    },
    {
      title: "Operatoren mit Rollen einladen",
      body: "Erstellen Sie benutzerdefinierte Rollen mit dem Berechtigungskatalog, bevor Sie Arbeit an Techniker oder Trainer übergeben.",
      href: "/org/roles",
    },
  ],
  diagram: {
    title: "Operator-Pfad erste Woche",
    nodes: [
      { id: "login", label: "Anmelden" },
      { id: "targets", label: "Mitarbeitende importieren" },
      { id: "smtp", label: "SMTP prüfen" },
      { id: "campaign", label: "Kampagne starten" },
      { id: "report", label: "Berichte prüfen" },
    ],
    edges: [
      { from: "login", to: "targets" },
      { from: "targets", to: "smtp" },
      { from: "smtp", to: "campaign" },
      { from: "campaign", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Checkliste Erste Schritte",
    stats: [
      { label: "Mitarbeitende", value: "0 → 186" },
      { label: "SMTP", value: "Verbunden" },
      { label: "Kampagnen", value: "Bereit" },
    ],
    highlight: {
      title: "Einrichtung Woche 1",
      caption: "3 von 4 Einrichtungsschritten erledigt · als Nächstes Kampagne starten",
      progress: 75,
    },
    rows: [
      { title: "Finance- + Ops-Mitarbeitende importieren", meta: "Erledigt · CSV" },
      { title: "SMTP mail.hrneck.com bestätigen", meta: "Erledigt · Integrationen" },
      { title: "Security Awareness Q4 erstellen", meta: "Als Nächstes · Kampagnen" },
    ],
    annotations: [
      { label: "Seitenleiste", note: "Guides bleiben auch vor der Anmeldung sichtbar." },
      { label: "In App öffnen", note: "Deep Links springen bei Authentifizierung zur Live-Org-Route." },
    ],
  },
  related: ["auth", "targets-groups", "settings", "training", "msp"],
};
