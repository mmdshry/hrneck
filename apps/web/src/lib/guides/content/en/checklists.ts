import type { GuideModule } from "@/lib/guides/types";

export const checklistsGuide: GuideModule = {
  slug: "checklists",
  title: "HR checklists",
  summary:
    "Design admin-only templates with conditional items, version them safely, bundle packs with auto-assign, and audit every answer change.",
  keywords: [
    "checklist",
    "onboarding",
    "offboarding",
    "template",
    "instance",
    "pack",
    "welcome pack",
    "auto-assign",
    "audit",
    "hr",
    "visible_when",
    "requires",
    "version",
  ],
  openInAppHref: "/org/checklists",
  overview:
    "Checklists are internal HR workflows—not learner content and never shown in /learn. Admins design flexible templates, copy the five system HR templates, bundle packs (for example a Welcome Pack), connect instances to employees, and fill them as operators. On save you choose whether a new template schema applies to open instances or only to new ones. Published packs can auto-assign when a new employee is created. Every answer change lands in the tenant activity log.",
  example: {
    title: "New hire Welcome Pack",
    narrative:
      "HR copies Onboarding and IT Access system templates, adds a “Needs laptop?” select that reveals a laptop checkbox via visible_when, and a manager sign-off that requires MFA enrolled. They publish a Welcome Pack with auto-assign. When alex.ng@acme.test is added, both instances appear on the employee profile; operators fill items and the audit trail shows who checked MFA enrollment.",
  },
  steps: [
    {
      title: "Open Checklists",
      body: "Browse custom and system templates from the Checklists hub. Copy a system template before assigning it.",
      href: "/org/checklists",
    },
    {
      title: "Edit a template",
      body: "Use the builder for item types, visible_when rules, and requires dependencies. Save with an apply-to-open or new-only choice.",
    },
    {
      title: "Build a pack",
      body: "Bundle templates into a Welcome Pack and optionally enable auto-assign on employee create.",
      href: "/org/checklists/packs",
    },
    {
      title: "Connect and fill",
      body: "Assign from Instances or an employee profile, complete items as HR, and review the activity-log history.",
      href: "/org/checklists/instances",
    },
  ],
  sections: [
    {
      title: "Template builder",
      body: "Templates are versioned form definitions. Employees never fill these—only operators with org.checklists.manage.",
      steps: [
        {
          title: "Start from a system template when possible",
          body: "Five seeded templates cover Employee Onboarding, Employee Offboarding, IT Access Provisioning, Internal Transfer / Role Change, and Leave Return. Copy before editing so the system original stays intact.",
          href: "/org/checklists",
        },
        {
          title: "Add item types",
          body: "Supported types: section, checkbox, short text, long text, single select, multi select, date, number, file, link, and rich note.",
        },
        {
          title: "Use visible_when for conditionals",
          body: "Hide or show items based on earlier answers (for example show “Laptop asset tag” only when Needs laptop = yes).",
        },
        {
          title: "Use requires for dependencies",
          body: "Block an item until another item is complete (for example manager sign-off requires MFA enrolled).",
        },
        {
          title: "Open the builder",
          body: "Edit schema on /org/checklists/[id]. Keep sections short so operators can scan open instances quickly.",
        },
      ],
    },
    {
      title: "Versioning on save",
      body: "Saving creates a new template version. You decide how open work is affected.",
      steps: [
        {
          title: "Choose apply to open instances",
          body: "Push the new schema onto instances that are still open when the process change must apply immediately.",
        },
        {
          title: "Or choose new-only",
          body: "Leave open instances on the previous schema and apply the new version only to future assignments—safer mid-wave.",
        },
      ],
    },
    {
      title: "Packs and auto-assign",
      body: "Packs bundle multiple templates for a single hire or lifecycle event.",
      steps: [
        {
          title: "Create and publish a pack",
          body: "Add templates, name the pack (Welcome Pack is the common pattern), and publish when ready.",
          href: "/org/checklists/packs",
        },
        {
          title: "Enable auto-assign on hire",
          body: "When enabled, creating a new employee attaches pack instances automatically. Confirm this on the employee profile after CSV import or manual add.",
        },
        {
          title: "Welcome Pack seed",
          body: "Demo tenants may already include a Welcome Pack that bundles onboarding plus IT access—clone rather than rebuild.",
        },
      ],
    },
    {
      title: "Instances and audit",
      body: "An instance is one template version bound to one employee.",
      steps: [
        {
          title: "Assign from Instances or the employee profile",
          body: "Connect a template or pack from /org/checklists/instances or from /org/targets/[id]. Progress shows on both surfaces.",
          href: "/org/checklists/instances",
        },
        {
          title: "Fill as HR",
          body: "Complete checkboxes, text, selects, dates, numbers, files, and links. File answers upload on the instance detail page.",
        },
        {
          title: "Review the audit trail",
          body: "Each answer change is logged in the tenant activity log. Use the instance audit UI when you need who-changed-what for compliance.",
        },
      ],
    },
  ],
  diagram: {
    title: "Template, pack, and employee flow",
    nodes: [
      { id: "template", label: "Template version" },
      { id: "pack", label: "Checklist pack" },
      { id: "target", label: "Employee" },
      { id: "instance", label: "Instance" },
      { id: "audit", label: "Audit trail" },
    ],
    edges: [
      { from: "template", to: "pack" },
      { from: "template", to: "instance" },
      { from: "pack", to: "instance" },
      { from: "target", to: "instance" },
      { from: "instance", to: "audit" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Checklist instances",
    stats: [
      { label: "Open", value: "11" },
      { label: "Packs", value: "1 welcome" },
      { label: "Templates", value: "5 system" },
    ],
    highlight: {
      title: "Welcome Pack · alex.ng@acme.test",
      caption: "Onboarding + IT access connected",
      progress: 78,
    },
    rows: [
      { title: "MFA enrolled", meta: "Checkbox · Done" },
      { title: "Laptop required?", meta: "Visible when Needs laptop = yes" },
      { title: "Manager sign-off", meta: "Pending · requires MFA" },
    ],
    annotations: [
      { label: "Packs", note: "Welcome Pack can auto-assign on hire." },
      { label: "Audit", note: "Every answer change is logged in the tenant DB." },
    ],
  },
  related: ["targets-groups", "users-roles", "reporting"],
};
