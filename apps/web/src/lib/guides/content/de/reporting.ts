import type { GuideModule } from "@/lib/guides/types";

export const reportingGuide: GuideModule = {
  slug: "reporting",
  title: "Berichte & PDF-Export",
  summary:
    "Erkunden Sie detaillierte Bericht-Tabs, planen Sie E-Mail-CSV und exportieren Sie Quartals-PDFs mit Archiven.",
  keywords: ["berichte", "pdf", "csv", "planen", "export", "analytics", "archiv"],
  openInAppHref: "/org/reports",
  overview:
    "Berichte decken Zusammenfassungs-Dashboards plus detaillierte Tabs (Unternehmen, Benutzer, Targets, Kampagnen, Schulung, Checklisten, Ticketing) mit CSV-Download ab. Planen Sie monatliche/wöchentliche/vierteljährliche E-Mail-Berichte, exportieren Sie Quartals-PDFs aus der Kalender-UI und durchsuchen Sie Archive (nach sechs Monaten bereinigt).",
  example: {
    title: "Board-Pack für Q4",
    narrative:
      "Am ersten Montag im Januar öffnet Mira Export, wählt Q4, erzeugt das DomPDF-Pack zu Schulungsabschluss und Risiko, lädt das Archiv herunter und bestätigt, dass die geplante vierteljährliche CSV auch an leadership@acme.test ging.",
  },
  steps: [
    {
      title: "Berichte öffnen",
      body: "Prüfen Sie Zusammenfassungskarten und wechseln Sie in detaillierte Tabs für die benötigte Domäne.",
      href: "/org/reports",
    },
    {
      title: "CSV herunterladen",
      body: "Jeder detaillierte Tab bietet einen CSV-Download für Offline-Analyse.",
    },
    {
      title: "E-Mail-Berichte planen",
      body: "Konfigurieren Sie monatliche, wöchentliche oder vierteljährliche Rhythmen, damit Stakeholder CSV automatisch erhalten.",
      href: "/org/reports",
    },
    {
      title: "Quartals-PDF exportieren",
      body: "Nutzen Sie den Exportkalender, um DomPDF-Archive zu erzeugen und herunterzuladen.",
      href: "/org/reports/export",
    },
    {
      title: "Archive prüfen",
      body: "Laden Sie frühere Exporte aus der Archivliste erneut herunter; älter als sechs Monate werden bereinigt.",
    },
  ],
  diagram: {
    title: "Bericht-Zustellungspfade",
    nodes: [
      { id: "tabs", label: "Bericht-Tabs" },
      { id: "csv", label: "CSV-Download" },
      { id: "schedule", label: "E-Mail-Plan" },
      { id: "pdf", label: "Quartals-PDF" },
      { id: "archive", label: "Archive" },
    ],
    edges: [
      { from: "tabs", to: "csv" },
      { from: "tabs", to: "schedule" },
      { from: "tabs", to: "pdf" },
      { from: "pdf", to: "archive" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Berichtsexport",
    stats: [
      { label: "Q4-PDF", value: "Bereit" },
      { label: "Pläne", value: "3" },
      { label: "Archive", value: "5" },
    ],
    highlight: {
      title: "Quartalspack · 2025 Q4",
      caption: "Schulung + Risiko + Checklist-Zusammenfassung · 2,4 MB",
      progress: 100,
    },
    rows: [
      { title: "Schulungsabschluss", meta: "CSV · Wöchentlich an ops@" },
      { title: "Ticketing-Volumen", meta: "CSV · Monatlich" },
      { title: "Q3-PDF-Archiv", meta: "Aufbewahrt · 4 Monate übrig" },
    ],
    annotations: [
      { label: "Kalender", note: "Quartal wählen, erzeugen, dann herunterladen." },
      { label: "Webhook-Stub", note: "Delivery-Hooks sind für künftige Automatisierung vorbereitet." },
    ],
  },
  related: ["training", "checklists", "ticketing"],
};
