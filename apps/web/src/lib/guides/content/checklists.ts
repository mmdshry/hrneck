import type { GuideModule } from "@/lib/guides/types";

export const checklistsGuide: GuideModule = {
  slug: "checklists",
  title: "HR checklists",
  summary:
    "Build admin-only checklist templates, spawn per-target instances, and audit every change.",
  keywords: [
    "checklist",
    "onboarding",
    "offboarding",
    "template",
    "instance",
    "audit",
    "hr",
  ],
  openInAppHref: "/org/checklists",
  overview:
    "Checklists are internal HR workflows—not learner content. Admins design flexible templates (section, checkbox, text, select, date, number, file, link, rich note) with conditional visibility and dependencies, then create instances bound to Targets. Five system templates cover onboarding, offboarding, IT access, transfer, and leave return.",
  example: {
    title: "New hire IT access checklist",
    narrative:
      "HR clones the system “IT access” template, adds a conditional laptop request field when role = Field, applies the schema to open instances, and assigns an instance to target alex.ng@acme.test. The audit trail shows who checked MFA enrollment.",
  },
  steps: [
    {
      title: "Open Checklists",
      body: "Browse custom and system templates from the Checklists hub.",
      href: "/org/checklists",
    },
    {
      title: "Edit a template",
      body: "Use the builder to add item types, visible_when rules, and requires dependencies.",
    },
    {
      title: "Choose apply behavior",
      body: "When saving, decide whether schema changes apply to open instances or new instances only.",
    },
    {
      title: "Create instances",
      body: "Spawn an instance per target from the instances list and complete items over time.",
      href: "/org/checklists/instances",
    },
    {
      title: "Review the audit trail",
      body: "Open an instance to see activity-log history of field updates and completions.",
    },
  ],
  diagram: {
    title: "Template to instance flow",
    nodes: [
      { id: "template", label: "Template version" },
      { id: "builder", label: "Item builder" },
      { id: "target", label: "Target" },
      { id: "instance", label: "Instance" },
      { id: "audit", label: "Audit trail" },
    ],
    edges: [
      { from: "template", to: "builder" },
      { from: "builder", to: "instance" },
      { from: "target", to: "instance" },
      { from: "instance", to: "audit" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Checklist instances",
    stats: [
      { label: "Open", value: "11" },
      { label: "Overdue", value: "3" },
      { label: "Templates", value: "5 system" },
    ],
    highlight: {
      title: "IT access · alex.ng@acme.test",
      caption: "7 of 9 items done · laptop request visible",
      progress: 78,
    },
    rows: [
      { title: "MFA enrolled", meta: "Checkbox · Done" },
      { title: "Laptop required?", meta: "Visible when Role = Field" },
      { title: "Manager sign-off", meta: "Pending · requires MFA" },
    ],
    annotations: [
      { label: "Builder", note: "Conditional visibility keeps forms short." },
      { label: "Audit", note: "Every answer change is logged in the tenant DB." },
    ],
  },
  related: ["targets-groups", "users-roles", "reporting"],
};
