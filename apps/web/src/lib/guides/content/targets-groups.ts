import type { GuideModule } from "@/lib/guides/types";

export const targetsGroupsGuide: GuideModule = {
  slug: "targets-groups",
  title: "Targets & groups",
  summary:
    "Build the employee audience with CRUD, CSV import, groups, risk scores, and directory sync.",
  keywords: ["targets", "groups", "csv", "directory", "entra", "audience", "risk"],
  openInAppHref: "/org/targets",
  overview:
    "Targets are employees in the training and checklist audience—they are not RBAC users. Group them by department, import via CSV, run mock Entra/Google directory sync until live credentials exist, and review risk scores before launching campaigns.",
  example: {
    title: "Finance CSV import before Q4",
    narrative:
      "Priya uploads finance-q4.csv (186 rows), maps department to the Finance group, runs directory sync to catch leavers, and flags two High risk targets for mandatory training.",
  },
  steps: [
    {
      title: "Open Targets & Groups",
      body: "Manage people, departments, and sync from the Targets workspace.",
      href: "/org/targets",
    },
    {
      title: "Create or import targets",
      body: "Add individuals manually or upload a CSV with email, name, and department columns.",
    },
    {
      title: "Organize groups",
      body: "Attach targets to groups so campaigns and assignments can target whole departments.",
    },
    {
      title: "Run directory sync",
      body: "Use the mock Entra/Google sync to refresh users and groups before a campaign. Live Graph credentials come later.",
    },
    {
      title: "Review risk scores",
      body: "Sort by risk to prioritize high-risk employees in the next training wave.",
    },
  ],
  diagram: {
    title: "Audience preparation flow",
    nodes: [
      { id: "csv", label: "CSV / CRUD" },
      { id: "sync", label: "Directory sync" },
      { id: "groups", label: "Groups" },
      { id: "risk", label: "Risk scores" },
      { id: "ready", label: "Campaign-ready" },
    ],
    edges: [
      { from: "csv", to: "groups" },
      { from: "sync", to: "groups" },
      { from: "groups", to: "risk" },
      { from: "risk", to: "ready" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Targets & Groups",
    stats: [
      { label: "Targets", value: "186" },
      { label: "Groups", value: "8" },
      { label: "High risk", value: "2" },
    ],
    highlight: {
      title: "Finance department",
      caption: "CSV import succeeded · sync dry-run found 3 leavers",
      progress: 100,
    },
    rows: [
      { title: "alex.ng@acme.test", meta: "Finance · Risk High" },
      { title: "maya.cole@acme.test", meta: "Finance · Risk Medium" },
      { title: "ops-all", meta: "Group · 64 members" },
    ],
    annotations: [
      { label: "CSV", note: "Import validates emails before creating targets." },
      { label: "Sync", note: "Mock drivers return fixture users until cloud creds exist." },
    ],
  },
  related: ["training", "checklists", "getting-started"],
};
