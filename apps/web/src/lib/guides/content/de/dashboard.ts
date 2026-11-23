import type { GuideModule } from "@/lib/guides/types";

export const dashboardGuide: GuideModule = {
  slug: "dashboard",
  title: "Organisations-Dashboard",
  summary:
    "Lesen Sie Live-Metriken für die Module, die Ihre Berechtigungen zulassen, und springen Sie in die Workflows, die Aufmerksamkeit brauchen.",
  keywords: ["dashboard", "metriken", "live", "übersicht", "berechtigungen", "lage"],
  openInAppHref: "/org",
  overview:
    "Das Organisations-Dashboard zeigt berechtigungsgefilterte Metrik-Widgets—Schulungsabschluss und Risiko, offene Checklisten, Ticketing-Druck und Personenanzahlen—statt eines festen Shortcut-Menüs. Operatoren mit org.reports.view erhalten eine Live-Übersicht vom detaillierten Berichtskanal; andere sehen modulspezifische Zähler, sofern verfügbar.",
  example: {
    title: "Montags-Lagebesprechung",
    narrative:
      "Vor dem Standup öffnet Jordan /org und sieht den Schulungsabschluss bei 86 %, offene Checklisten und SLA-Druck im Ticketing-Widget. Sie verlinken tief in Schulung und dann Ticketing, ohne ein generisches Shortcut-Raster zu suchen.",
  },
  steps: [
    {
      title: "Dashboard öffnen",
      body: "Gehen Sie zu Organisation → Dashboard. Widgets spiegeln den angemeldeten Tenant und nur Ihre Berechtigungen wider.",
      href: "/org",
    },
    {
      title: "Widgets lesen, die Sie sehen können",
      body: "Schulung (Berichte oder Schulungsverwaltung), Checklisten, Ticketing und Personen erscheinen nur, wenn Sie die passende Berechtigung haben.",
    },
    {
      title: "Direkt in die Arbeit springen",
      body: "Jedes Widget verlinkt in sein Modul, damit Sie handeln können, ohne das alte Shortcut-Menü zu nutzen.",
    },
    {
      title: "Live-Aktualisierung vertrauen, wenn Berichte erlaubt sind",
      body: "Mit org.reports.view halten Reverb-reports-detailed-Snapshots die Karten live. Wenn der Socket abbricht, zeigt die UI Live-Sync nicht verfügbar und verbindet automatisch erneut—es gibt keinen Aktualisieren-Button.",
    },
  ],
  diagram: {
    title: "Dashboard-Informationsfluss",
    nodes: [
      { id: "perms", label: "Berechtigungen" },
      { id: "api", label: "Org-APIs" },
      { id: "ws", label: "Live-Kanal" },
      { id: "cards", label: "Metrik-Widgets" },
    ],
    edges: [
      { from: "perms", to: "cards", label: "filtern" },
      { from: "api", to: "cards", label: "snapshot" },
      { from: "ws", to: "cards", label: "aktualisiert" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Org-Dashboard",
    stats: [
      { label: "Abschluss", value: "86%" },
      { label: "Offene Checklisten", value: "3" },
      { label: "Offene Tickets", value: "14" },
    ],
    highlight: {
      title: "Schulungslage · Diese Woche",
      caption: "412 zugewiesen · Finance holt noch auf · Empfänger ohne Aktion markiert",
      progress: 86,
    },
    rows: [
      { title: "Schulung", meta: "86 % abgeschlossen · 2 laufende Kampagnen" },
      { title: "Checklisten", meta: "3 offene Instanzen" },
      { title: "Ticketing", meta: "14 offen · SLA-Überwachung" },
    ],
    annotations: [
      { label: "Berechtigungsfilter", note: "Widgets werden ausgeblendet, wenn die passende org.*-Berechtigung fehlt." },
      { label: "Deep Links", note: "Ein Klick in Schulung, Checklisten, Ticketing oder Benutzer." },
    ],
  },
  related: ["training", "reporting", "targets-groups"],
};
