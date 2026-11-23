import type { GuideModule } from "@/lib/guides/types";

export const authGuide: GuideModule = {
  slug: "auth",
  title: "Anmeldung, MFA & Passwort",
  summary:
    "Melden Sie sich auf dem richtigen Host an, schließen Sie MFA ab, setzen Sie ein vergessenes Passwort zurück und verstehen Sie E-Mail-Verifizierung sowie Wiederherstellungscodes.",
  keywords: [
    "login",
    "mfa",
    "passwort",
    "vergessen",
    "zurücksetzen",
    "wiederherstellung",
    "verifizierung",
    "sitzung",
    "totp",
  ],
  openInAppHref: "/login",
  overview:
    "HRNECK nutzt Cookie-Sitzungen auf Tenant-Hosts ({slug}.hrneck.test) und dem App-Alias. Die Anmeldung unterstützt Angemeldet bleiben, eine E-Mail-Verifizierungsschranke (von Admins erstellte Benutzer sind typischerweise bereits verifiziert), TOTP-MFA mit einmaligen Wiederherstellungscodes sowie Vergessen-/Zurücksetzen-/Ändern-Flows für Passwörter. MFA-Einrichtung und -Deaktivierung liegen unter Einstellungen → MFA für angemeldete Operatoren. Plattform-Mitarbeiter und Org-Benutzer teilen dieselben Login-Seiten, landen aber je nach Rolle auf /msp oder /org. Eine Passwortänderung löscht jeden Staff-Tenant-Kontext.",
  example: {
    title: "Org-Admin stellt Zugang vor dem Launch wieder her",
    narrative:
      "Sara vergisst am Morgen des Q4-Launches ihr Passwort, nutzt /login/forgot, setzt es über den E-Mail-Link zurück, meldet sich an, schließt /login/mfa mit ihrem Authenticator ab und speichert neue Wiederherstellungscodes unter Einstellungen → MFA, bevor sie die Kampagne zuweist.",
  },
  steps: [
    {
      title: "Den richtigen Host öffnen",
      body: "Org-Benutzer nutzen {slug}.hrneck.test. Lokale Demo-Tenants umfassen itneck, test und company. Plattform-Mitarbeiter können den zentralen Host und danach MSP nutzen.",
      href: "/login",
    },
    {
      title: "Anmelden",
      body: "E-Mail und Passwort mit optionalem Angemeldet bleiben. Nicht verifizierte E-Mails werden blockiert, bis die Verifizierung abgeschlossen ist.",
    },
    {
      title: "MFA bei Aufforderung abschließen",
      body: "Geben Sie den TOTP-Code unter /login/mfa ein. Wenn Sie den Authenticator verlieren, nutzen Sie einen einmaligen Wiederherstellungscode und melden Sie MFA erneut an.",
      href: "/login/mfa",
    },
    {
      title: "Passwort vergessen oder zurücksetzen",
      body: "Nutzen Sie /login/forgot für eine Zurücksetzen-E-Mail und dann /login/reset mit dem Token. Nach einer Passwortänderung betreten Sie jeden geöffneten MSP-Tenant erneut.",
      href: "/login/forgot",
    },
    {
      title: "MFA in den Einstellungen verwalten",
      body: "Angemeldete Operatoren richten MFA ein, bestätigen oder deaktivieren es und sehen Wiederherstellungscodes unter Einstellungen → MFA.",
      href: "/org/settings/mfa",
    },
  ],
  sections: [
    {
      title: "Wer landet wo",
      steps: [
        {
          title: "Org-Operatoren",
          body: "org_admin und benutzerdefinierte Rollen landen nach MFA auf /org auf ihrem Tenant-Host.",
        },
        {
          title: "Plattform-Mitarbeiter",
          body: "platform_super_admin / platform_agent nutzen /msp und betreten optional einen Tenant. Filament-MFA verwendet dieselben Authenticator-Spalten auf admin.hrneck.test.",
        },
        {
          title: "Lernende und Portalnutzer",
          body: "Dieselben Login-Seiten; nach der Sitzungserstellung öffnen sie /learn oder /portal basierend auf Berechtigungen und Einschreibung.",
        },
      ],
    },
  ],
  diagram: {
    title: "Auth-Pfad",
    nodes: [
      { id: "host", label: "Tenant-Host" },
      { id: "login", label: "Login" },
      { id: "mfa", label: "MFA-Challenge" },
      { id: "app", label: "Org / MSP / Learn" },
      { id: "reset", label: "Vergessen / zurücksetzen" },
    ],
    edges: [
      { from: "host", to: "login" },
      { from: "login", to: "mfa" },
      { from: "mfa", to: "app" },
      { from: "login", to: "reset" },
      { from: "reset", to: "login" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Anmelden",
    stats: [
      { label: "MFA", value: "Erforderlich" },
      { label: "Sitzung", value: "Cookie" },
      { label: "Host", value: "acme.hrneck.test" },
    ],
    highlight: {
      title: "Authenticator-Challenge",
      caption: "6-stelligen Code oder einen Wiederherstellungscode eingeben",
      progress: 100,
    },
    rows: [
      { title: "/login", meta: "E-Mail + Passwort" },
      { title: "/login/mfa", meta: "TOTP · Wiederherstellungscodes" },
      { title: "/login/forgot", meta: "Zurücksetzen-E-Mail" },
    ],
    annotations: [
      { label: "Verifizierung", note: "Nicht verifizierte Benutzer kommen nicht durch die Login-Schranke." },
      { label: "Staff-Kontext", note: "Passwortänderung löscht den MSP-Enter-Zustand." },
    ],
  },
  related: ["getting-started", "msp", "settings", "learner-portal"],
};
