import type { GuideModule } from "@/lib/guides/types";

export const ticketingGuide: GuideModule = {
  slug: "ticketing",
  title: "ITIL ticketing & KB",
  summary:
    "Run Incident, Problem, Service Request, and Change desks with SLA, email ingest, and knowledge base.",
  keywords: [
    "ticketing",
    "incident",
    "sla",
    "kb",
    "email",
    "desk",
    "service desk",
  ],
  openInAppHref: "/org/ticketing",
  overview:
    "The ticketing module mirrors ITIL service-desk basics: desks, tickets with notes/tasks/attachments, bulk ops, procedures and escalation, SLA policies, IMAP email readers, KB articles (including ticket→KB convert), global search, preferences, and CSV/JSON reporting. Employees use the separate service portal; operators stay in /org/ticketing.",
  example: {
    title: "Phishing report becomes KB article",
    narrative:
      "Technician Lee creates an Incident “Suspicious invoice PDF”, adds a note and containment task, resolves it, converts the ticket to a KB article “How to report phishing”, then confirms it appears under org KB and published portal KB.",
  },
  steps: [
    {
      title: "Open the ticket queue",
      body: "Filter by desk, stage, and assignee from the ticketing hub.",
      href: "/org/ticketing",
    },
    {
      title: "Create or triage a ticket",
      body: "Capture notes, tasks, and attachments; move stages according to the desk workflow.",
    },
    {
      title: "Configure desks & SLA",
      body: "Review Incident/Problem/Service Request/Change desks and SLA goals under Desks.",
      href: "/org/ticketing/desks",
    },
    {
      title: "Ingest email",
      body: "Configure an email reader, then let the IMAP poller create tickets from inbound mail.",
      href: "/org/ticketing/email",
    },
    {
      title: "Publish knowledge",
      body: "Convert resolved tickets to KB articles and verify Search All / portal visibility.",
      href: "/org/ticketing/kb",
    },
    {
      title: "Export reports",
      body: "Download CSV summaries or JSON packages from ticketing reports.",
      href: "/org/ticketing/reports",
    },
  ],
  diagram: {
    title: "Ticket to knowledge loop",
    nodes: [
      { id: "intake", label: "Email / portal / agent" },
      { id: "ticket", label: "Ticket" },
      { id: "sla", label: "SLA + escalate" },
      { id: "resolve", label: "Resolve" },
      { id: "kb", label: "KB article" },
    ],
    edges: [
      { from: "intake", to: "ticket" },
      { from: "ticket", to: "sla" },
      { from: "sla", to: "resolve" },
      { from: "resolve", to: "kb" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Incident desk",
    stats: [
      { label: "Waiting", value: "5" },
      { label: "Breaches", value: "0" },
      { label: "KB hits", value: "128" },
    ],
    highlight: {
      title: "INC-1842 · Suspicious invoice PDF",
      caption: "Stage In Progress · SLA 4h remaining",
      progress: 55,
    },
    rows: [
      { title: "Note · Quarantined attachment", meta: "Lee · 10:14" },
      { title: "Task · Reset mailbox rules", meta: "Open" },
      { title: "Convert to KB", meta: "Available after resolve" },
    ],
    annotations: [
      { label: "Desks", note: "ITIL desks share stages but keep separate queues." },
      { label: "Portal", note: "Employees submit via /portal/tickets, not the org queue." },
    ],
  },
  related: ["announcements-notifications", "reporting", "users-roles"],
};
