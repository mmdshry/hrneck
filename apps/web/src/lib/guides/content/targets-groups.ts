import type { GuideModule } from "@/lib/guides/types";

export const targetsGroupsGuide: GuideModule = {
  slug: "targets-groups",
  title: "Employees, departments & groups",
  summary:
    "Build the employee audience with CRUD, CSV import, departments, groups, risk scores, and directory sync.",
  keywords: [
    "employees",
    "targets",
    "departments",
    "groups",
    "csv",
    "directory",
    "entra",
    "audience",
    "risk",
  ],
  openInAppHref: "/org/targets",
  overview:
    "Employees (Targets) are the training and checklist audience and are paired with login Users (typically the learner role)—they are not org operators. Manage employees on Employees (CSV and directory sync), open an employee profile to see connected checklists, keep departments as a managed list for forms, then organize them into Groups with a member picker so campaigns can address whole departments. Soft-archive a group via status=inactive. Published checklist packs with auto-assign create instances when a new employee is added.",
  example: {
    title: "Finance CSV import before Q4",
    narrative:
      "Priya uploads finance-q4.csv (186 rows) on Employees, creates a Finance department and group, selects members, runs directory sync to catch leavers, and opens a new hire profile to confirm the Welcome Pack checklists were auto-assigned.",
  },
  steps: [
    {
      title: "Open Employees",
      body: "Import employees, review risk scores, and run directory sync from the Employees workspace.",
      href: "/org/targets",
    },
    {
      title: "Manage departments",
      body: "Create and maintain departments on the Departments page, then select them when adding or importing employees.",
      href: "/org/departments",
    },
    {
      title: "Create or import employees",
      body: "Add a single person with Add employee, upload a CSV with email, name, and department columns, or run mock directory sync. Auto-assign packs attach onboarding checklists to new rows.",
    },
    {
      title: "Open an employee profile",
      body: "Use Open on a row to review connected checklists and connect a template or pack from the profile.",
    },
    {
      title: "Open Groups",
      body: "Create audience groups separately from the employee list.",
      href: "/org/groups",
    },
    {
      title: "Pick members in the group modal",
      body: "Name the group and select employees with the member picker so campaigns can target whole departments.",
    },
    {
      title: "Run directory sync",
      body: "Use the mock Entra/Google sync on Employees to refresh users and groups before a campaign. Live Graph credentials come later.",
      href: "/org/targets",
    },
  ],
  diagram: {
    title: "Audience preparation flow",
    nodes: [
      { id: "csv", label: "CSV / CRUD" },
      { id: "depts", label: "Departments" },
      { id: "sync", label: "Directory sync" },
      { id: "groups", label: "Groups" },
      { id: "risk", label: "Risk scores" },
      { id: "ready", label: "Campaign-ready" },
    ],
    edges: [
      { from: "csv", to: "depts" },
      { from: "depts", to: "groups" },
      { from: "sync", to: "groups" },
      { from: "groups", to: "risk" },
      { from: "risk", to: "ready" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Employees",
    stats: [
      { label: "Employees", value: "186" },
      { label: "Departments", value: "6" },
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
      { label: "CSV", note: "Import validates emails and creates departments by name when needed." },
      { label: "Sync", note: "Mock drivers return fixture users until cloud creds exist." },
    ],
  },
  related: ["training", "checklists", "getting-started"],
};
