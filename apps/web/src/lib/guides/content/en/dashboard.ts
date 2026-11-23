import type { GuideModule } from "@/lib/guides/types";

export const dashboardGuide: GuideModule = {
  slug: "dashboard",
  title: "Organization dashboard",
  summary:
    "Read live metrics for the modules your permissions allow, then jump into the workflows that need attention.",
  keywords: ["dashboard", "metrics", "live", "overview", "permissions", "posture"],
  openInAppHref: "/org",
  overview:
    "The org dashboard shows permission-gated metric widgets—training completion and risk, open checklists, ticketing pressure, and people counts—instead of a fixed shortcut menu. Operators with org.reports.view get a live overview from the detailed reports channel; others see module-specific counts where available.",
  example: {
    title: "Monday posture review",
    narrative:
      "Before standup, Jordan opens /org and sees training completion at 86%, open checklists, and SLA pressure on the ticketing widget. They deep-link into Training, then Ticketing, without hunting a generic shortcut grid.",
  },
  steps: [
    {
      title: "Open the dashboard",
      body: "Go to Organization → Dashboard. Widgets reflect the signed-in tenant and your permissions only.",
      href: "/org",
    },
    {
      title: "Read the widgets you can see",
      body: "Training (reports or training manage), Checklists, Ticketing, and People appear only when you hold the matching permission.",
    },
    {
      title: "Deep-link into work",
      body: "Each widget links into its module so you can act without using the old shortcut menu.",
    },
    {
      title: "Trust live refresh when reporting is allowed",
      body: "With org.reports.view, Reverb reports-detailed snapshots keep cards live. If the socket drops, the UI shows Live sync unavailable and reconnects automatically—there is no Refresh button.",
    },
  ],
  diagram: {
    title: "Dashboard information flow",
    nodes: [
      { id: "perms", label: "Permissions" },
      { id: "api", label: "Org APIs" },
      { id: "ws", label: "Live channel" },
      { id: "cards", label: "Metric widgets" },
    ],
    edges: [
      { from: "perms", to: "cards", label: "gate" },
      { from: "api", to: "cards", label: "snapshot" },
      { from: "ws", to: "cards", label: "updated" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Org dashboard",
    stats: [
      { label: "Completion", value: "86%" },
      { label: "Open checklists", value: "3" },
      { label: "Open tickets", value: "14" },
    ],
    highlight: {
      title: "Training posture · This week",
      caption: "412 assigned · Finance still catching up · No-action recipients flagged",
      progress: 86,
    },
    rows: [
      { title: "Training", meta: "86% complete · 2 running campaigns" },
      { title: "Checklists", meta: "3 open instances" },
      { title: "Ticketing", meta: "14 open · SLA watch" },
    ],
    annotations: [
      { label: "Permission gate", note: "Widgets hide when you lack the matching org.* permission." },
      { label: "Deep links", note: "One click into Training, Checklists, Ticketing, or Users." },
    ],
  },
  related: ["training", "reporting", "targets-groups"],
};
