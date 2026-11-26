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
    "sso",
    "google",
    "microsoft",
    "passkey",
  ],
  openInAppHref: "/login",
  overview:
    "HRNECK nutzt Cookie-Sitzungen auf Tenant-Hosts ({slug}.hrneck.test) und dem App-Alias. Die Anmeldung unterstützt Angemeldet bleiben, eine E-Mail-Verifizierungsschranke (von Admins erstellte Benutzer sind typischerweise bereits verifiziert), Mit Google oder Microsoft fortfahren für Konten, die ein Administrator bereits angelegt hat, TOTP-MFA oder Passkeys als zweiten Faktor mit einmaligen Wiederherstellungscodes sowie Vergessen-/Zurücksetzen-/Ändern-Flows für Passwörter. Einrichtung, Passkeys und Deaktivierung von MFA liegen unter Einstellungen → MFA für angemeldete Operatoren. Plattform-Mitarbeiter und Org-Benutzer teilen dieselben Login-Seiten, landen aber je nach Rolle auf /msp oder /org. Eine Passwortänderung löscht jeden Staff-Tenant-Kontext.",
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
      body: "Nutzen Sie E-Mail und Passwort mit optionalem Angemeldet bleiben oder Mit Google fortfahren bzw. Mit Microsoft fortfahren, sobald diese Schaltfläche erscheint. Nicht verifizierte E-Mails werden blockiert, bis die Verifizierung abgeschlossen ist.",
    },
    {
      title: "MFA bei Aufforderung abschließen",
      body: "Geben Sie auf /login/mfa den Code aus Ihrer Authenticator-App ein oder wählen Sie Mit Passkey anmelden, wenn Sie einen Passkey hinzugefügt haben. Wenn Sie beides verlieren, nutzen Sie einen einmaligen Wiederherstellungscode und richten Sie MFA erneut ein.",
      href: "/login/mfa",
    },
    {
      title: "Passwort vergessen oder zurücksetzen",
      body: "Nutzen Sie /login/forgot für eine Zurücksetzen-E-Mail und dann /login/reset mit dem Token. Nach einer Passwortänderung betreten Sie jeden geöffneten MSP-Tenant erneut.",
      href: "/login/forgot",
    },
    {
      title: "MFA in den Einstellungen verwalten",
      body: "Angemeldete Operatoren richten MFA ein, bestätigen oder deaktivieren es, fügen Passkeys hinzu oder entfernen sie und sehen Wiederherstellungscodes unter Einstellungen → MFA. Das Entfernen eines Passkeys verlangt Ihr Kontopasswort. Das Deaktivieren von MFA verlangt Ihr Passwort und einen Code oder Passkey und entfernt alle Passkeys.",
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
          body: "platform_super_admin / platform_agent nutzen /msp und betreten optional einen Tenant.",
        },
        {
          title: "Lernende und Portalnutzer",
          body: "Dieselben Login-Seiten; nach der Sitzungserstellung öffnen sie /org (Org-Admins) oder /portal (Mitarbeiter-Dashboard) je nach Berechtigungen.",
        },
      ],
    },
    {
      title: "Anmeldeoptionen",
      steps: [
        {
          title: "Google oder Microsoft (SSO)",
          body: "Die Login-Seite zeigt Mit Google fortfahren oder Mit Microsoft fortfahren nur, wenn Ihre Organisation diesen Anbieter eingerichtet hat. SSO funktioniert nur für Konten, die ein Administrator bereits angelegt hat: Es erstellt nie einen Benutzer und verknüpft ein bestehendes Konto über die E-Mail-Adresse nur, wenn der Anbieter diese bestätigt. Ihr Identitätsanbieter übernimmt das MFA, daher erscheint nach SSO keine MFA-Abfrage von HRNECK. Die Anmeldung mit Passwort bleibt neben SSO verfügbar.",
        },
        {
          title: "Passkeys",
          body: "Ein Passkey, etwa auf diesem Gerät oder als Sicherheitsschlüssel, kann Ihr zweiter Faktor auf /login/mfa neben der Authenticator-App sein. Fügen Sie Passkeys unter Einstellungen → MFA hinzu. Der erste hinzugefügte Faktor aktiviert MFA und zeigt Wiederherstellungscodes nur einmal an, bewahren Sie diese sicher auf. Passkeys benötigen eine sichere Verbindung (https:// oder localhost) und funktionieren nicht auf einer benutzerdefinierten Domain eines Tenants.",
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
      { title: "/login/mfa", meta: "TOTP · Passkey · Wiederherstellungscodes" },
      { title: "/login/forgot", meta: "Zurücksetzen-E-Mail" },
    ],
    annotations: [
      { label: "Verifizierung", note: "Nicht verifizierte Benutzer kommen nicht durch die Login-Schranke." },
      { label: "Staff-Kontext", note: "Passwortänderung löscht den MSP-Enter-Zustand." },
    ],
  },
  related: ["getting-started", "msp", "settings", "learner-portal"],
};
