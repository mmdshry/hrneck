import type { GuideModule } from "@/lib/guides/types";

export const ticketingGuide: GuideModule = {
  slug: "ticketing",
  title: "ITIL ticketing & KB",
  summary:
    "Run Incident, Problem, Service Request, and Change desks with SLA, bulk ops, email ingest, KB, search, and CSV/JSON reporting.",
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
    "escalation",
    "procedures",
    "preferences",
    "merge",
  ],
  openInAppHref: "/org/ticketing",
  overview:
    "The ticketing module covers ITIL service-desk basics for operators in /org/ticketing: desks, tickets with notes/tasks/attachments, bulk actions, procedures and escalation, SLA policies, IMAP email readers, KB articles (including ticket→KB convert), Search All, preferences, and CSV/PDF/JSON reporting. Employees submit and track work in the separate service portal (/portal)—see that guide for end-user steps. Permissions split across org.ticketing.tickets, .admin, .kb, .reports, and .portal, with seeded sd_* / kb_admin roles.",
  example: {
    title: "Phishing report becomes KB article",
    narrative:
      "Technician Lee creates Incident INC-1842 “Suspicious invoice PDF”, adds a note and containment task, attaches the sample, resolves it under SLA, converts the ticket to a KB article “How to report phishing”, confirms Search All and published portal KB, then downloads the weekly ticketing CSV for the service desk standup.",
  },
  steps: [
    {
      title: "Open the ticket queue",
      body: "Filter by desk, stage, assignee, and archived state from the ticketing hub.",
      href: "/org/ticketing",
    },
    {
      title: "Triage a ticket",
      body: "Capture notes, tasks, and attachments; move stages; copy or link related tickets as needed.",
    },
    {
      title: "Configure desks, SLA, and email",
      body: "Review ITIL desks, procedures, and SLA under Desks; wire IMAP readers under Email.",
      href: "/org/ticketing/desks",
    },
    {
      title: "Publish knowledge and export",
      body: "Convert resolved tickets to KB, verify Search All / portal visibility, then export CSV/PDF or JSON packages.",
      href: "/org/ticketing/kb",
    },
  ],
  sections: [
    {
      title: "Queue triage",
      body: "Operators with org.ticketing.tickets work the live queue. Desks include Incident, Problem, Service Request, Change, plus a Knowledge Base desk type.",
      steps: [
        {
          title: "Create or open a ticket",
          body: "Set stage, status, priority, severity, category, and assignee. Number prefixes come from the desk configuration.",
          href: "/org/ticketing",
        },
        {
          title: "Add notes, tasks, and attachments",
          body: "Notes capture work; tasks support a complete toggle; attachments upload and download from the ticket detail page.",
        },
        {
          title: "Copy or link tickets",
          body: "Copy a ticket when you need a parallel track; link related tickets to keep incident and problem records connected.",
        },
      ],
    },
    {
      title: "Bulk actions and preferences",
      steps: [
        {
          title: "Run bulk actions",
          body: "From the queue, bulk archive, unarchive, mark read/unread, stop notification, delete, merge, group update, link, or unlock. Use the archived filter to find closed bulk work.",
        },
        {
          title: "Set preferences",
          body: "Configure notification delay, notification scope, and default desk so new work lands where your team expects it.",
        },
      ],
    },
    {
      title: "Desks, SLA, and procedures",
      body: "Desk admin needs org.ticketing.admin. Stages, support rows, procedures, SLA, and templates all live under Desks.",
      steps: [
        {
          title: "Edit desks and stages",
          body: "Create or edit desks, stage sequence, escalation flags, and terminal stages. Maintain statuses, priorities, severities, and categories as support rows.",
          href: "/org/ticketing/desks",
        },
        {
          title: "Attach procedures",
          body: "Bind procedures to create, stage enter, or escalation events so technicians get consistent playbooks.",
        },
        {
          title: "Define SLA policies",
          body: "Set response and resolve minutes by priority. Escalation jobs advance level when escalation_due_at passes.",
        },
        {
          title: "Maintain message and note templates",
          body: "Reuse templates for common replies and internal notes to keep tone and steps consistent.",
        },
      ],
    },
    {
      title: "Email ingest",
      steps: [
        {
          title: "Configure an email reader",
          body: "Create, edit, or delete readers under Email. Use test ingest to prove a sample message becomes a ticket.",
          href: "/org/ticketing/email",
        },
        {
          title: "Rely on the IMAP poller",
          body: "The poller creates tickets from inbound mail. Delayed notifications are part of the same pipeline—tune delay in preferences if the team is flooded.",
        },
      ],
    },
    {
      title: "Knowledge base and Search All",
      steps: [
        {
          title: "Author and publish articles",
          body: "Create, edit, publish/unpublish, or delete KB articles. Unpublished drafts stay off the employee portal.",
          href: "/org/ticketing/kb",
        },
        {
          title: "Convert ticket → KB",
          body: "After resolve, convert a ticket into an article so the fix becomes searchable knowledge.",
        },
        {
          title: "Use Search All",
          body: "Search tickets and KB together from /org/ticketing/search when you are not sure whether the answer is an open incident or a published article.",
          href: "/org/ticketing/search",
        },
      ],
    },
    {
      title: "Reports and packages",
      steps: [
        {
          title: "Download CSV or PDF summaries",
          body: "Open, resolved, response breach, and resolve breach metrics export from ticketing reports.",
          href: "/org/ticketing/reports",
        },
        {
          title: "JSON import/export (admin)",
          body: "Export or import selected tickets as JSON packages when migrating or cloning desk data. Requires ticketing admin permission.",
        },
      ],
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
      { id: "portal", label: "Service portal" },
    ],
    edges: [
      { from: "intake", to: "ticket" },
      { from: "ticket", to: "sla" },
      { from: "sla", to: "resolve" },
      { from: "resolve", to: "kb" },
      { from: "kb", to: "portal" },
      { from: "portal", to: "intake", label: "new request" },
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
      { label: "Desks", note: "ITIL desks share stage patterns but keep separate queues." },
      { label: "Portal", note: "Employees submit via /portal/tickets, not the org queue." },
    ],
  },
  related: [
    "service-portal",
    "announcements-notifications",
    "reporting",
    "users-roles",
  ],
};
