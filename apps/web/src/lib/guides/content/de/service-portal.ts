import type { GuideModule } from "@/lib/guides/types";

export const servicePortalGuide: GuideModule = {
  slug: "service-portal",
  title: "Serviceportal",
  summary:
    "Reichen Sie eigene Tickets ein und verfolgen Sie sie, fügen Sie Notizen hinzu und durchsuchen Sie veröffentlichte Knowledge-Base-Artikel unter /portal.",
  keywords: [
    "portal",
    "tickets",
    "kb",
    "knowledge base",
    "service desk",
    "endnutzer",
    "einreichen",
  ],
  openInAppHref: "/portal/tickets",
  overview:
    "Das Serviceportal ist die mitarbeiterseitige Seite des Ticketings. Tenant-Zugang nutzt org.ticketing.portal—die Seed-Rolle learner enthält nur diese Berechtigung—, sodass gepaarte Mitarbeiter-Benutzer /portal öffnen können, um Tickets zu listen und einzureichen, Notizen zu eigenen Anfragen hinzuzufügen und veröffentlichte KB-Artikel zu durchsuchen. Techniker arbeiten weiterhin die Warteschlange unter /org/ticketing. Der Portal-Header verlinkt immer Meine Tickets, Knowledge Base und Learn; Techniker erscheint nur, wenn der angemeldete Benutzer auch org.ticketing.tickets oder org.ticketing.admin hat (nicht für reine Learner-Konten).",
  example: {
    title: "Mitarbeitender meldet eine verdächtige Rechnung",
    narrative:
      "Alex meldet sich mit einem Learner-Konto an, öffnet /portal/tickets, reicht „Verdächtiges Rechnungs-PDF“ mit kurzer Beschreibung ein, fügt später eine Notiz mit Screenshot hinzu und findet danach den veröffentlichten KB-Artikel „So melden Sie Phishing“ unter /portal/kb, nachdem der Service Desk INC-1842 konvertiert hat.",
  },
  steps: [
    {
      title: "Anmelden",
      body: "Nutzen Sie Ihr Tenant-Konto. Portal-APIs erfordern org.ticketing.portal; die Seed-Rolle learner gewährt genau das (kein Org-Warteschlangen-Zugang).",
      href: "/login",
    },
    {
      title: "Meine Tickets öffnen",
      body: "/portal leitet zu Tickets um. Listen Sie Ihre Anfragen und öffnen Sie eine für Details.",
      href: "/portal/tickets",
    },
    {
      title: "Anfrage einreichen",
      body: "Erstellen Sie ein neues Ticket mit klarem Titel und Beschreibung. Es landet in der Org-Desk-Warteschlange für Techniker.",
    },
    {
      title: "Notizen zu Ihrem Ticket hinzufügen",
      body: "Folgen Sie mit mehr Detail von der Ticket-Detailseite nach, ohne die Org-Ticketing-UI zu brauchen.",
    },
    {
      title: "Veröffentlichte KB durchsuchen",
      body: "Öffnen Sie /portal/kb für Artikel, die der Service Desk veröffentlicht hat. Entwürfe bleiben hier unsichtbar.",
      href: "/portal/kb",
    },
  ],
  sections: [
    {
      title: "Portal vs. Org-Warteschlange",
      steps: [
        {
          title: "Mitarbeitende bleiben in /portal",
          body: "Erwarten Sie keine Desk-Admin-, Bulk-Merge-, SLA-Editoren oder E-Mail-Reader im Portal—das sind Operator-Werkzeuge.",
        },
        {
          title: "Techniker nutzen /org/ticketing",
          body: "Triage, SLA, IMAP-Ingest und Ticket→KB-Konvertierung leben in der Org-App. Siehe den ITIL-Ticketing-Guide.",
          href: "/org/ticketing",
        },
        {
          title: "Header-Shortcuts",
          body: "Nutzen Sie Learn für Schulungszuweisungen. Techniker erscheint nur, wenn Sie org.ticketing.tickets oder org.ticketing.admin haben—reine Learner bleiben in /portal.",
        },
      ],
    },
  ],
  diagram: {
    title: "Portal-Anfragefluss",
    nodes: [
      { id: "user", label: "Portalnutzer" },
      { id: "ticket", label: "Mein Ticket" },
      { id: "queue", label: "Org-Warteschlange" },
      { id: "kb", label: "Veröffentlichte KB" },
    ],
    edges: [
      { from: "user", to: "ticket" },
      { from: "ticket", to: "queue" },
      { from: "queue", to: "kb", label: "konvertieren" },
      { from: "kb", to: "user" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Portal · Meine Tickets",
    stats: [
      { label: "Offen", value: "1" },
      { label: "Gelöst", value: "3" },
      { label: "KB", value: "Veröffentlicht" },
    ],
    highlight: {
      title: "Verdächtiges Rechnungs-PDF",
      caption: "Wartet auf Service Desk · Notiz hinzugefügt 10:21",
      progress: 35,
    },
    rows: [
      { title: "Meine Anfrage · Verdächtiges Rechnungs-PDF", meta: "Offen" },
      { title: "KB · So melden Sie Phishing", meta: "Veröffentlicht" },
      { title: "Header · Learn", meta: "Schulungszuweisungen" },
    ],
    annotations: [
      { label: "Umfang", note: "Sie sehen im Portal nur Ihre eigenen Tickets." },
      { label: "KB", note: "Nur veröffentlichte Artikel erscheinen unter /portal/kb." },
    ],
  },
  related: ["ticketing", "learner-portal", "auth"],
};
