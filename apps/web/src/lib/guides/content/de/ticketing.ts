import type { GuideModule } from "@/lib/guides/types";

export const ticketingGuide: GuideModule = {
  slug: "ticketing",
  title: "ITIL-Ticketing & KB",
  summary:
    "Betreiben Sie Incident-, Problem-, Service-Request- und Change-Desks mit SLA, Bulk-Ops, E-Mail-Ingest, KB, Suche und CSV/JSON-Berichten.",
  keywords: [
    "ticketing",
    "incident",
    "sla",
    "kb",
    "email",
    "desk",
    "service desk",
    "bulk",
    "imap",
    "eskalation",
    "verfahren",
    "einstellungen",
    "zusammenführen",
  ],
  openInAppHref: "/org/ticketing",
  overview:
    "Das Ticketing-Modul deckt ITIL-Service-Desk-Grundlagen für Operatoren unter /org/ticketing ab: Desks, Tickets mit Notizen/Aufgaben/Anhängen, Bulk-Aktionen, Verfahren und Eskalation, SLA-Richtlinien, IMAP-E-Mail-Reader, KB-Artikel (einschließlich Ticket→KB-Konvertierung), Search All, Präferenzen und CSV/PDF/JSON-Berichte. Mitarbeitende reichen Arbeit im separaten Serviceportal (/portal) ein und verfolgen sie—siehe diesen Guide für Endnutzer-Schritte. Berechtigungen teilen sich in org.ticketing.tickets, .admin, .reports und .portal, mit Seed-Rollen sd_* / kb_admin. KB-Artikel haben einen eigenen Bereich (/org/kb) mit den Berechtigungen org.kb.view und org.kb.manage.",
  example: {
    title: "Phishing-Meldung wird KB-Artikel",
    narrative:
      "Techniker Lee erstellt Incident INC-1842 „Verdächtiges Rechnungs-PDF“, fügt eine Notiz und Containment-Aufgabe hinzu, hängt die Probe an, löst es innerhalb des SLA, konvertiert das Ticket in einen KB-Artikel „So melden Sie Phishing“, bestätigt Search All und veröffentlichte Portal-KB und lädt die wöchentliche Ticketing-CSV für den Service-Desk-Standup herunter.",
  },
  steps: [
    {
      title: "Ticketwarteschlange öffnen",
      body: "Filtern Sie nach Desk, Stufe, Bearbeiter und archiviertem Status vom Ticketing-Hub.",
      href: "/org/ticketing",
    },
    {
      title: "Ticket triageieren",
      body: "Erfassen Sie Notizen, Aufgaben und Anhänge; verschieben Sie Stufen; kopieren oder verknüpfen Sie verwandte Tickets nach Bedarf.",
    },
    {
      title: "Desks, SLA und E-Mail konfigurieren",
      body: "Prüfen Sie ITIL-Desks, Verfahren und SLA unter Desks; verdrahten Sie IMAP-Reader unter E-Mail.",
      href: "/org/ticketing/desks",
    },
    {
      title: "Wissen veröffentlichen und exportieren",
      body: "Konvertieren Sie gelöste Tickets in KB, prüfen Sie Search All / Portal-Sichtbarkeit und exportieren Sie dann CSV/PDF- oder JSON-Pakete.",
      href: "/org/kb",
    },
  ],
  sections: [
    {
      title: "Warteschlangen-Triage",
      body: "Operatoren mit org.ticketing.tickets arbeiten die Live-Warteschlange. Desks umfassen Incident, Problem, Service Request, Change plus einen Knowledge-Base-Desktyp.",
      steps: [
        {
          title: "Ticket erstellen oder öffnen",
          body: "Setzen Sie Stufe, Status, Priorität, Schweregrad, Kategorie und Bearbeiter. Nummernpräfixe kommen aus der Desk-Konfiguration.",
          href: "/org/ticketing",
        },
        {
          title: "Notizen, Aufgaben und Anhänge hinzufügen",
          body: "Notizen erfassen Arbeit; Aufgaben unterstützen einen Erledigt-Schalter; Anhänge werden auf der Ticket-Detailseite hoch- und heruntergeladen.",
        },
        {
          title: "Tickets kopieren oder verknüpfen",
          body: "Kopieren Sie ein Ticket, wenn Sie eine parallele Spur brauchen; verknüpfen Sie verwandte Tickets, um Incident- und Problem-Datensätze verbunden zu halten.",
        },
      ],
    },
    {
      title: "Bulk-Aktionen und Präferenzen",
      steps: [
        {
          title: "Bulk-Aktionen ausführen",
          body: "Aus der Warteschlange: bulk archivieren, wiederherstellen, gelesen/ungelesen markieren, Benachrichtigung stoppen, löschen, zusammenführen, Gruppenupdate, verknüpfen oder entsperren. Nutzen Sie den Archivfilter, um geschlossene Bulk-Arbeit zu finden.",
        },
        {
          title: "Präferenzen setzen",
          body: "Konfigurieren Sie Benachrichtigungsverzögerung, Benachrichtigungsumfang und Standard-Desk, damit neue Arbeit dort landet, wo Ihr Team sie erwartet.",
        },
      ],
    },
    {
      title: "Desks, SLA und Verfahren",
      body: "Desk-Admin braucht org.ticketing.admin. Stufen, Support-Zeilen, Verfahren, SLA und Vorlagen liegen alle unter Desks.",
      steps: [
        {
          title: "Desks und Stufen bearbeiten",
          body: "Erstellen oder bearbeiten Sie Desks, Stufenfolge, Eskalationsflags und Endstufen. Pflegen Sie Status, Prioritäten, Schweregrade und Kategorien als Support-Zeilen.",
          href: "/org/ticketing/desks",
        },
        {
          title: "Verfahren anhängen",
          body: "Binden Sie Verfahren an Create-, Stufen-Enter- oder Eskalationsereignisse, damit Techniker konsistente Playbooks erhalten.",
        },
        {
          title: "SLA-Richtlinien definieren",
          body: "Setzen Sie Antwort- und Lösungsminuten nach Priorität. Eskalationsjobs erhöhen die Stufe, wenn escalation_due_at überschritten wird.",
        },
        {
          title: "Nachrichten- und Notizvorlagen pflegen",
          body: "Wiederverwenden Sie Vorlagen für häufige Antworten und interne Notizen, um Ton und Schritte konsistent zu halten.",
        },
      ],
    },
    {
      title: "E-Mail-Ingest",
      steps: [
        {
          title: "E-Mail-Reader konfigurieren",
          body: "Erstellen, bearbeiten oder löschen Sie Reader unter E-Mail. Nutzen Sie Test-Ingest, um zu beweisen, dass eine Beispielnachricht ein Ticket wird.",
          href: "/org/ticketing/email",
        },
        {
          title: "Auf den IMAP-Poller verlassen",
          body: "Der Poller erstellt Tickets aus eingehender Mail. Verzögerte Benachrichtigungen sind Teil derselben Pipeline—stimmen Sie die Verzögerung in den Präferenzen an, wenn das Team überflutet wird.",
        },
      ],
    },
    {
      title: "Knowledge Base und Search All",
      steps: [
        {
          title: "Artikel erstellen und veröffentlichen",
          body: "Erstellen, bearbeiten, veröffentlichen/zurückziehen oder löschen Sie KB-Artikel. Unveröffentlichte Entwürfe bleiben vom Mitarbeiterportal fern.",
          href: "/org/kb",
        },
        {
          title: "Ticket → KB konvertieren",
          body: "Nach dem Lösen konvertieren Sie ein Ticket in einen Artikel, damit die Lösung durchsuchbares Wissen wird.",
        },
        {
          title: "Search All nutzen",
          body: "Suchen Sie Tickets und KB gemeinsam unter /org/ticketing/search, wenn Sie unsicher sind, ob die Antwort ein offener Incident oder ein veröffentlichter Artikel ist.",
          href: "/org/ticketing/search",
        },
      ],
    },
    {
      title: "Berichte und Pakete",
      steps: [
        {
          title: "CSV- oder PDF-Zusammenfassungen herunterladen",
          body: "Offen, gelöst, Antwortverletzung und Lösungsverletzung exportieren aus Ticketing-Berichten.",
          href: "/org/ticketing/reports",
        },
        {
          title: "JSON-Import/Export (Admin)",
          body: "Exportieren oder importieren Sie ausgewählte Tickets als JSON-Pakete beim Migrieren oder Klonen von Desk-Daten. Erfordert Ticketing-Admin-Berechtigung.",
        },
      ],
    },
  ],
  diagram: {
    title: "Ticket-zu-Wissen-Schleife",
    nodes: [
      { id: "intake", label: "E-Mail / Portal / Agent" },
      { id: "ticket", label: "Ticket" },
      { id: "sla", label: "SLA + eskalieren" },
      { id: "resolve", label: "Lösen" },
      { id: "kb", label: "KB-Artikel" },
      { id: "portal", label: "Serviceportal" },
    ],
    edges: [
      { from: "intake", to: "ticket" },
      { from: "ticket", to: "sla" },
      { from: "sla", to: "resolve" },
      { from: "resolve", to: "kb" },
      { from: "kb", to: "portal" },
      { from: "portal", to: "intake", label: "neue Anfrage" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Incident-Desk",
    stats: [
      { label: "Wartend", value: "5" },
      { label: "Verletzungen", value: "0" },
      { label: "KB-Treffer", value: "128" },
    ],
    highlight: {
      title: "INC-1842 · Verdächtiges Rechnungs-PDF",
      caption: "Stufe In Bearbeitung · SLA 4 Std. verbleibend",
      progress: 55,
    },
    rows: [
      { title: "Notiz · Anhang in Quarantäne", meta: "Lee · 10:14" },
      { title: "Aufgabe · Postfachregeln zurücksetzen", meta: "Offen" },
      { title: "In KB konvertieren", meta: "Verfügbar nach Lösung" },
    ],
    annotations: [
      { label: "Desks", note: "ITIL-Desks teilen Stufenmuster, behalten aber getrennte Warteschlangen." },
      { label: "Portal", note: "Mitarbeitende reichen über /portal/tickets ein, nicht über die Org-Warteschlange." },
    ],
  },
  related: [
    "service-portal",
    "announcements-notifications",
    "reporting",
    "users-roles",
  ],
};
