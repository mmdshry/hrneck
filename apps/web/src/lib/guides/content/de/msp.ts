import type { GuideModule } from "@/lib/guides/types";

export const mspGuide: GuideModule = {
  slug: "msp",
  title: "MSP-Konsole",
  summary:
    "Durchsuchen Sie Tenant-Organisationen als Plattform-Mitarbeiter, öffnen Sie einen Tenant-Admin-Kontext und kehren Sie zum MSP-Verzeichnis zurück.",
  keywords: [
    "msp",
    "plattform",
    "tenant",
    "organisationen",
    "staff",
    "eintreten",
    "verlassen",
    "platform_super_admin",
    "platform_agent",
  ],
  openInAppHref: "/msp",
  overview:
    "Die MSP-Konsole unter /msp ist nur für Plattform-Mitarbeiter (platform_super_admin und platform_agent). Sie listet Tenant-Organisationen mit Branche, Mitarbeiterband, Status und Schulungsflags und lässt Staff Tenant-Admin öffnen—was einen echten staff_tenant_id-Kontext setzt, damit /org für diesen Kunden lädt. Nutzen Sie Tenant verlassen im Org-Shell-Banner, um zu /msp zurückzukehren. Filament unter admin.hrneck.test/admin ist eine separate Staff-Oberfläche (Gesundheit, Aktivitätsprotokoll, Tenant-Umschalter, tiefere Ops) und wird von diesem Guide nicht abgedeckt.",
  example: {
    title: "Staff hilft Acme vor dem Q4-Launch",
    narrative:
      "Plattform-Agent Jordan öffnet /msp, findet Acme (aktiv, 100–249 Mitarbeitende, Schulung an), klickt Tenant-Admin öffnen, landet auf /org mit vollen Berechtigungen, prüft SMTP unter Einstellungen, wählt Tenant verlassen und kehrt zum MSP-Verzeichnis zurück.",
  },
  steps: [
    {
      title: "Als Plattform-Mitarbeiter anmelden",
      body: "Nutzen Sie ein Plattform-Konto wie admin@hrneck.test. Reine Org-Benutzer können /msp nicht öffnen.",
      href: "/login",
    },
    {
      title: "MSP-Verzeichnis öffnen",
      body: "Prüfen Sie Tenants: Name, Branche, Mitarbeiterband (1–10 bis 500+), aktiv/inaktiv und Schulung an/aus. Hosts folgen {slug}.hrneck.test.",
      href: "/msp",
    },
    {
      title: "Tenant-Admin öffnen",
      body: "Betreten Sie den ausgewählten Tenant. Die Next-Org-App lädt mit Staff-Tenant-Kontext und behandelt Sie, als hätten Sie jede Org-Berechtigung, während Sie drinnen sind.",
    },
    {
      title: "In /org arbeiten",
      body: "Nutzen Sie die normale Org-Seitenleiste (Schulung, Mitarbeitende, Ticketing, Einstellungen usw.). Live-Metriken und Guides verhalten sich wie eine org_admin-Sitzung.",
      href: "/org",
    },
    {
      title: "Tenant verlassen",
      body: "Nutzen Sie die Banner-Steuerung Tenant verlassen, um den Staff-Kontext zu löschen und zu /msp zurückzukehren. Eine Passwortänderung löscht ebenfalls den Staff-Tenant-Kontext.",
    },
  ],
  sections: [
    {
      title: "MSP vs. Filament vs. Org",
      steps: [
        {
          title: "MSP = Verzeichnis + Eintreten",
          body: "Next /msp ist das leichte Staff-Verzeichnis und der Einstieg in die Kunden-Org-UI.",
        },
        {
          title: "Filament = zentrale Ops",
          body: "admin.hrneck.test/admin ergänzt Plattform-Gesundheit, Aktivitätsprotokoll, Organisations-CRUD und Tenant-Ops-Ressourcen nach einem Filament-Tenant-Wechsel. Kunden sehen Filament nie.",
        },
        {
          title: "Org-Benutzer bleiben auf ihrem Host",
          body: "org_admin-Konten melden sich auf {slug}.hrneck.test an und brauchen nie MSP Eintreten/Verlassen.",
        },
      ],
    },
  ],
  diagram: {
    title: "Staff-Tenant-Kontext",
    nodes: [
      { id: "login", label: "Plattform-Login" },
      { id: "msp", label: "/msp-Verzeichnis" },
      { id: "enter", label: "Tenant betreten" },
      { id: "org", label: "/org-Arbeitsbereich" },
      { id: "exit", label: "Tenant verlassen" },
    ],
    edges: [
      { from: "login", to: "msp" },
      { from: "msp", to: "enter" },
      { from: "enter", to: "org" },
      { from: "org", to: "exit" },
      { from: "exit", to: "msp" },
    ],
  },
  mock: {
    chromeTitle: "HRNECK · MSP · Organisationen",
    stats: [
      { label: "Tenants", value: "3" },
      { label: "Aktiv", value: "3" },
      { label: "Kontext", value: "Keiner" },
    ],
    highlight: {
      title: "Acme Corp",
      caption: "100–249 · Schulung an · Tenant-Admin öffnen",
      progress: 100,
    },
    rows: [
      { title: "acme.hrneck.test", meta: "Aktiv · Branche Services" },
      { title: "itneck.hrneck.test", meta: "Demo-Tenant" },
      { title: "Tenant verlassen", meta: "Nur sichtbar, während Sie in /org sind" },
    ],
    annotations: [
      { label: "Eintreten", note: "Setzt staff_tenant_id, bevor /org lädt." },
      { label: "Umfang", note: "Nur platform_super_admin / platform_agent sehen /msp." },
    ],
  },
  related: ["getting-started", "auth", "settings", "users-roles"],
};
