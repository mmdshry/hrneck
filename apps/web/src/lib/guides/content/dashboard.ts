import type { GuideModule } from "@/lib/guides/types";

export const dashboardGuide: GuideModule = {
  slug: "dashboard",
  title: "Organization dashboard",
  summary:
    "Read live training posture, risk signals, and jump into the workflows that need attention.",
  keywords: ["dashboard", "metrics", "live", "overview", "posture"],
  openInAppHref: "/org",
  overview:
    "The org dashboard summarizes training completion, open checklist work, ticketing pressure, and export shortcuts. Live updates arrive over the tenant WebSocket channel so operators do not need to refresh manually.",
  example: {
    title: "Monday posture review",
    narrative:
      "Before standup, Jordan opens /org and sees completion at 86%, two high-risk targets, and three overdue checklist instances. They deep-link into Targets, then Export, without hunting the sidebar.",
  },
  steps: [
    {
      title: "Open the dashboard",
      body: "Go to Organization → Dashboard. Metrics reflect the signed-in tenant only.",
      href: "/org",
    },
    {
      title: "Read the posture strip",
      body: "Completion, assignments, and risk summaries highlight whether campaigns are on track.",
    },
    {
      title: "Use quick links",
      body: "Jump to Training, Targets, Export, or Settings from the dashboard shortcuts.",
    },
    {
      title: "Trust live refresh",
      body: "When Reverb is running, snapshot/updated events refresh cards without a hard reload.",
    },
  ],
  diagram: {
    title: "Dashboard information flow",
    nodes: [
      { id: "api", label: "Org APIs" },
      { id: "ws", label: "Live channel" },
      { id: "cards", label: "Metric cards" },
      { id: "links", label: "Quick links" },
    ],
    edges: [
      { from: "api", to: "cards", label: "snapshot" },
      { from: "ws", to: "cards", label: "updated" },
      { from: "cards", to: "links" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Org dashboard",
    stats: [
      { label: "Completion", value: "86%" },
      { label: "At risk", value: "2" },
      { label: "Open tickets", value: "14" },
    ],
    highlight: {
      title: "Training posture · This week",
      caption: "412 assigned · 38 overdue · Finance still catching up",
      progress: 86,
    },
    rows: [
      { title: "Security Awareness Q4", meta: "Campaign · 72% complete" },
      { title: "Onboarding checklists", meta: "3 overdue instances" },
      { title: "Incident desk", meta: "5 waiting · SLA OK" },
    ],
    annotations: [
      { label: "Live badge", note: "Updates push when campaign progress changes." },
      { label: "Quick links", note: "One click into Training, Targets, or Export." },
    ],
  },
  related: ["training", "reporting", "targets-groups"],
};
