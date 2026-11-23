import type { GuideModule } from "@/lib/guides/types";

export const reportingGuide: GuideModule = {
  slug: "reporting",
  title: "Reporting & PDF export",
  summary:
    "Explore detailed report tabs, schedule email CSV, and export quarterly PDFs with archives.",
  keywords: ["reports", "pdf", "csv", "schedule", "export", "analytics", "archive"],
  openInAppHref: "/org/reports",
  overview:
    "Reporting covers summary dashboards plus detailed tabs (company, users, targets, campaigns, training, checklists, ticketing) with CSV download. Schedule monthly/weekly/quarterly email reports, export quarterly PDFs from the calendar UI, and browse archives (pruned after six months).",
  example: {
    title: "Board pack for Q4",
    narrative:
      "On the first Monday of January, Mira opens Export, selects Q4, generates the DomPDF pack covering training completion and risk, downloads the archive, and confirms the scheduled quarterly CSV also mailed to leadership@acme.test.",
  },
  steps: [
    {
      title: "Open Reporting",
      body: "Review summary cards and switch into detailed tabs for the domain you need.",
      href: "/org/reports",
    },
    {
      title: "Download CSV",
      body: "Each detailed tab exposes a CSV download for offline analysis.",
    },
    {
      title: "Schedule email reports",
      body: "Configure monthly, weekly, or quarterly cadences so stakeholders receive CSV automatically.",
      href: "/org/reports",
    },
    {
      title: "Export quarterly PDF",
      body: "Use the export calendar to generate and download DomPDF archives.",
      href: "/org/reports/export",
    },
    {
      title: "Check archives",
      body: "Re-download previous exports from the archive list; older than six months are pruned.",
    },
  ],
  diagram: {
    title: "Report delivery paths",
    nodes: [
      { id: "tabs", label: "Report tabs" },
      { id: "csv", label: "CSV download" },
      { id: "schedule", label: "Email schedule" },
      { id: "pdf", label: "Quarterly PDF" },
      { id: "archive", label: "Archives" },
    ],
    edges: [
      { from: "tabs", to: "csv" },
      { from: "tabs", to: "schedule" },
      { from: "tabs", to: "pdf" },
      { from: "pdf", to: "archive" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Report export",
    stats: [
      { label: "Q4 PDF", value: "Ready" },
      { label: "Schedules", value: "3" },
      { label: "Archives", value: "5" },
    ],
    highlight: {
      title: "Quarterly pack · 2025 Q4",
      caption: "Training + risk + checklist summary · 2.4 MB",
      progress: 100,
    },
    rows: [
      { title: "Training completion", meta: "CSV · Weekly to ops@" },
      { title: "Ticketing volume", meta: "CSV · Monthly" },
      { title: "Q3 PDF archive", meta: "Retained · 4 months left" },
    ],
    annotations: [
      { label: "Calendar", note: "Pick a quarter, generate, then download." },
      { label: "Webhook stub", note: "Delivery hooks are prepared for future automation." },
    ],
  },
  related: ["training", "checklists", "ticketing"],
};
