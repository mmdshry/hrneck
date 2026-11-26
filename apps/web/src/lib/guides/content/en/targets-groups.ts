import type { GuideModule } from "@/lib/guides/types";

export const targetsGroupsGuide: GuideModule = {
  slug: "targets-groups",
  title: "Employees, departments & groups",
  summary:
    "Build the employee audience with CRUD, a CSV mapping wizard, departments, groups, and risk scores.",
  keywords: [
    "employees",
    "targets",
    "departments",
    "groups",
    "csv",
    "audience",
    "risk",
  ],
  openInAppHref: "/org/targets",
  overview:
    "Employees (Targets) are the training and checklist audience and are paired with login Users (typically the learner role)—they are not org operators. Manage employees on Employees (CRUD and CSV wizard), open an employee profile to see connected checklists, keep departments as a managed list for forms, then organize them into Groups with a member picker so campaigns can address whole departments. Soft-archive a group via status=inactive. Published checklist packs with auto-assign create instances when a new employee is added.",
  example: {
    title: "Finance CSV import before Q4",
    narrative:
      "Priya opens Import employees, uploads finance-q4.csv (186 rows), maps Email Address → email and saves an HR template, previews create/update counts, commits the import, then confirms Welcome Pack checklists were auto-assigned on a new hire profile.",
  },
  steps: [
    {
      title: "Open Employees",
      body: "Import employees and review risk scores from the Employees workspace.",
      href: "/org/targets",
    },
    {
      title: "Manage departments",
      body: "Create and maintain departments on the Departments page, then select them when adding or importing employees.",
      href: "/org/departments",
    },
    {
      title: "Create or import employees",
      body: "Add or edit a person with the employee form (title, manager, hire date, phone, location, employment type, language, risk). Use Import employees for a wizard: upload any company CSV, map columns to platform fields (email required), optionally save a per-tenant mapping template, preview row errors, then commit. Auto-assign packs attach onboarding checklists and prefill role/start/manager from the profile.",
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
  ],
  diagram: {
    title: "Audience preparation flow",
    nodes: [
      { id: "csv", label: "CSV / CRUD" },
      { id: "depts", label: "Departments" },
      { id: "groups", label: "Groups" },
      { id: "risk", label: "Risk scores" },
      { id: "ready", label: "Campaign-ready" },
    ],
    edges: [
      { from: "csv", to: "depts" },
      { from: "depts", to: "groups" },
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
      caption: "CSV import succeeded · 186 employees ready",
      progress: 100,
    },
    rows: [
      { title: "alex.ng@acme.test", meta: "Finance · Risk High" },
      { title: "maya.cole@acme.test", meta: "Finance · Risk Medium" },
      { title: "ops-all", meta: "Group · 64 members" },
    ],
    annotations: [
      { label: "CSV", note: "Wizard maps columns, dry-runs row errors, then upserts by email and creates departments by name when needed." },
      { label: "Groups", note: "Use the member picker so campaigns can target whole departments." },
    ],
  },
  related: ["training", "checklists", "getting-started"],
};
