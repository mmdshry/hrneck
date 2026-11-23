import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Benutzer & Rollen",
  summary:
    "Laden Sie Org-Operatoren und Lernende ein, erstellen Sie benutzerdefinierte Rollen und mappen Sie den Berechtigungskatalog—einschließlich Ticketing-Presets.",
  keywords: ["benutzer", "rollen", "rbac", "berechtigungen", "sd_admin", "learner", "zugang"],
  openInAppHref: "/org/users",
  overview:
    "Org-Login-Benutzer umfassen Operatoren (org_admin und benutzerdefinierte Rollen) und Mitarbeitende. Jeder Mitarbeitende (Target) ist mit einem Benutzer gepaart, der typischerweise die Rolle learner hat, damit er sich bei /learn und dem Serviceportal anmelden kann. Nutzen Sie Benutzer, um Personen einzuladen, und Rollen, um Berechtigungen über Schulung, Checklisten, Ticketing, Berichte, Einstellungen und Ankündigungen zusammenzustellen. Ticketing liefert Preset-Rollen wie sd_admin, sd_technician, sd_user und kb_admin. Plattform-Staff-Rollen (platform_super_admin / platform_agent) sind Peers zueinander—keine Hierarchie über Org-Rollen—und betreten einen Tenant über MSP-Kontext.",
  example: {
    title: "Service-Desk-Techniker-Rolle",
    narrative:
      "Admin erstellt die Rolle „SD Technician“ mit org.ticketing.tickets und verwandten Desk-Berechtigungen, lädt lee@acme.test ein und prüft, dass Lee Incidents triageieren, aber Branding unter Einstellungen nicht ändern kann. Separat erhält eine Neueinstellung unter Mitarbeitende einen gepaarten Learner-Benutzer und kann /learn öffnen, ohne als Org-Operator zu erscheinen.",
  },
  steps: [
    {
      title: "Bestehende Benutzer prüfen",
      body: "Bestätigen Sie, wer bereits org_admin, learner oder benutzerdefinierte Rollen im Tenant hat.",
      href: "/org/users",
    },
    {
      title: "Rollen öffnen",
      body: "Prüfen Sie den Berechtigungskatalog und klonen oder erstellen Sie eine Rolle, die zur Aufgabe passt.",
      href: "/org/roles",
    },
    {
      title: "Ticketing-Presets sorgfältig zuweisen",
      body: "Nutzen Sie sd_*/kb_admin-Presets, wenn die Person nur Service-Desk-Umfang braucht.",
    },
    {
      title: "Operator einladen oder auf Mitarbeiterpaarung setzen",
      body: "Erstellen Sie einen Operator unter Benutzer mit der richtigen Rolle, oder fügen Sie einen Mitarbeitenden hinzu, damit ProvisionEmployeePair den gepaarten Learner-Benutzer/Login anlegt.",
    },
    {
      title: "Least Privilege prüfen",
      body: "Melden Sie sich als dieser Benutzer an (oder prüfen Sie Berechtigungen), um sicherzustellen, dass Einstellungen und Benutzer für Nicht-Admins gesperrt bleiben. MFA bleibt für jeden angemeldeten Org-Benutzer verfügbar.",
    },
  ],
  diagram: {
    title: "Zugangsmodell",
    nodes: [
      { id: "user", label: "Benutzer (Login)" },
      { id: "role", label: "Rolle" },
      { id: "perms", label: "Berechtigungen" },
      { id: "modules", label: "Org-Module" },
      { id: "target", label: "Target / Mitarbeitender" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "gepaarter Learner" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Rollen",
    stats: [
      { label: "Benutzer", value: "9" },
      { label: "Benutzerdefinierte Rollen", value: "4" },
      { label: "Presets", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Tickets + Desks · kein settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner · gepaartes Target" },
    ],
    annotations: [
      { label: "Katalog", note: "Berechtigungen werden auf /api/v1/org/* durchgesetzt." },
      { label: "Mitarbeitende", note: "Mitarbeitende sind Login-Benutzer über Target↔User-Paarung (learner)." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
