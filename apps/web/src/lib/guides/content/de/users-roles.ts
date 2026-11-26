import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Mitarbeitende & Rollen",
  summary:
    "Verwalten Sie Mitarbeitende und ihre Anmelde-Rollen, erstellen Sie benutzerdefinierte Rollen und mappen Sie den Berechtigungskatalog—einschließlich Ticketing-Presets.",
  keywords: ["benutzer", "mitarbeitende", "rollen", "rbac", "berechtigungen", "sd_admin", "learner", "zugang"],
  openInAppHref: "/org/targets",
  overview:
    "Anmeldekonten und Mitarbeitende sind eine Liste unter Mitarbeitende. Jeder Mitarbeitende hat eine Anmeldung, und seine Rolle (zum Beispiel learner, org_admin oder eine benutzerdefinierte Rolle) wird in der Zeile des Mitarbeitenden angezeigt, wo Sie sie ändern können. Ein neuer Mitarbeitender erhält standardmäßig die Rolle learner, damit er sein Dashboard unter /portal öffnen kann. Nutzen Sie Rollen, um Berechtigungen über Schulung, Checklisten, Ticketing, Berichte, Einstellungen und Ankündigungen zusammenzustellen. Ticketing liefert Preset-Rollen wie sd_admin, sd_technician, sd_user und kb_admin. Plattform-Staff-Rollen (platform_super_admin / platform_agent) sind Peers zueinander—keine Hierarchie über Org-Rollen—und betreten einen Tenant über MSP-Kontext.",
  example: {
    title: "Service-Desk-Techniker-Rolle",
    narrative:
      "Admin erstellt die Rolle „SD Technician“ mit org.ticketing.tickets und verwandten Desk-Berechtigungen, fügt lee@acme.test als Mitarbeitenden mit dieser Rolle hinzu und prüft, dass Lee Incidents triageieren, aber Branding unter Einstellungen nicht ändern kann. Eine neue Einstellung mit der Standardrolle learner öffnet /portal und zeigt ihre Kurse ohne Operator-Zugriff.",
  },
  steps: [
    {
      title: "Mitarbeitende und ihre Rollen prüfen",
      body: "Unter Mitarbeitende zeigt die Spalte Rolle die Rolle jeder Anmeldung. Prüfen Sie, wer bereits org_admin, learner oder benutzerdefinierte Rollen im Tenant hat.",
      href: "/org/targets",
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
      title: "Mitarbeitenden mit der richtigen Rolle anlegen",
      body: "Legen Sie unter Mitarbeitende einen Mitarbeitenden an und wählen Sie seine Rolle (Standard ist learner). Die Anmeldung wird automatisch erstellt und eingeladen; für Operatoren wählen Sie eine Rolle mit nur den nötigen Berechtigungen.",
    },
    {
      title: "Least Privilege prüfen",
      body: "Melden Sie sich als dieser Benutzer an (oder prüfen Sie Berechtigungen), um sicherzustellen, dass Einstellungen und Mitarbeitende für Nicht-Admins gesperrt bleiben. MFA bleibt für jeden angemeldeten Org-Benutzer verfügbar.",
    },
  ],
  diagram: {
    title: "Zugangsmodell",
    nodes: [
      { id: "user", label: "Anmeldung (Login)" },
      { id: "role", label: "Rolle" },
      { id: "perms", label: "Berechtigungen" },
      { id: "modules", label: "Org-Module" },
      { id: "target", label: "Mitarbeitender" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "verknüpfte Anmeldung" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Mitarbeitende",
    stats: [
      { label: "Mitarbeitende", value: "9" },
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
      { title: "maya@acme.test", meta: "learner" },
    ],
    annotations: [
      { label: "Katalog", note: "Berechtigungen werden auf /api/v1/org/* durchgesetzt." },
      { label: "Mitarbeitende", note: "Jeder Mitarbeitende hat eine Anmeldung; ihre Rolle wird in der Mitarbeitenden-Liste gesetzt." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
