import type { GuideModule } from "@/lib/guides/types";

export const servicePortalGuide: GuideModule = {
  slug: "service-portal",
  title: "Service portal",
  summary:
    "Submit and track your own tickets, add notes, and browse published knowledge base articles from /portal.",
  keywords: [
    "portal",
    "tickets",
    "kb",
    "knowledge base",
    "service desk",
    "end user",
    "submit",
  ],
  openInAppHref: "/portal/tickets",
  overview:
    "The service portal is the employee-facing side of ticketing. Tenant access uses org.ticketing.portal—the seeded learner role includes only that permission—so paired employee Users can open /portal to list and submit tickets, add notes on their own requests, and browse published KB articles. Technicians still work the queue in /org/ticketing. The portal header always links My tickets, Knowledge base, and Learn; Technician appears only when the signed-in user also has org.ticketing.tickets or org.ticketing.admin (not for learner-only accounts).",
  example: {
    title: "Employee reports a suspicious invoice",
    narrative:
      "Alex signs in with a learner account, opens /portal/tickets, submits “Suspicious invoice PDF” with a short description, later adds a note with a screenshot, then finds the published KB article “How to report phishing” under /portal/kb after the service desk converts INC-1842.",
  },
  steps: [
    {
      title: "Sign in",
      body: "Use your tenant account. Portal APIs require org.ticketing.portal; the seeded learner role grants exactly that (no org queue access).",
      href: "/login",
    },
    {
      title: "Open My tickets",
      body: "/portal redirects into tickets. List your requests and open one for detail.",
      href: "/portal/tickets",
    },
    {
      title: "Submit a request",
      body: "Create a new ticket with a clear title and description. It lands on the org desk queue for technicians.",
    },
    {
      title: "Add notes on your ticket",
      body: "Follow up with more detail from the ticket detail page without needing the org ticketing UI.",
    },
    {
      title: "Browse published KB",
      body: "Open /portal/kb for articles the service desk has published. Drafts stay invisible here.",
      href: "/portal/kb",
    },
  ],
  sections: [
    {
      title: "Portal vs org queue",
      steps: [
        {
          title: "Employees stay in /portal",
          body: "Do not expect desk admin, bulk merge, SLA editors, or email readers in the portal—those are operator tools.",
        },
        {
          title: "Technicians use /org/ticketing",
          body: "Triage, SLA, IMAP ingest, and ticket→KB convert live in the org app. See the ITIL ticketing guide.",
          href: "/org/ticketing",
        },
        {
          title: "Header shortcuts",
          body: "Use Learn for training assignments. Technician only shows when you have org.ticketing.tickets or org.ticketing.admin—learner-only users stay in /portal.",
        },
      ],
    },
  ],
  diagram: {
    title: "Portal request flow",
    nodes: [
      { id: "user", label: "Portal user" },
      { id: "ticket", label: "My ticket" },
      { id: "queue", label: "Org queue" },
      { id: "kb", label: "Published KB" },
    ],
    edges: [
      { from: "user", to: "ticket" },
      { from: "ticket", to: "queue" },
      { from: "queue", to: "kb", label: "convert" },
      { from: "kb", to: "user" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Portal · My tickets",
    stats: [
      { label: "Open", value: "1" },
      { label: "Resolved", value: "3" },
      { label: "KB", value: "Published" },
    ],
    highlight: {
      title: "Suspicious invoice PDF",
      caption: "Waiting on service desk · note added 10:21",
      progress: 35,
    },
    rows: [
      { title: "My request · Suspicious invoice PDF", meta: "Open" },
      { title: "KB · How to report phishing", meta: "Published" },
      { title: "Header · Learn", meta: "Training assignments" },
    ],
    annotations: [
      { label: "Scope", note: "You only see your own tickets in the portal." },
      { label: "KB", note: "Only published articles appear under /portal/kb." },
    ],
  },
  related: ["ticketing", "learner-portal", "auth"],
};
