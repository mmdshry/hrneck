import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Users & roles",
  summary:
    "Manage employees and their sign-in roles, craft custom roles, and map the permission catalog—including ticketing presets.",
  keywords: ["users", "employees", "roles", "rbac", "permissions", "sd_admin", "learner", "access"],
  openInAppHref: "/org/targets",
  overview:
    "Employees and login accounts are one list on Employees. Every employee has a sign-in, and its role (for example learner, org_admin, or a custom role) is shown on the employee's row where you can change it. A new employee gets the learner role by default so they can open their dashboard at /portal. Use Roles to compose permissions across training, checklists, ticketing, reports, settings, and announcements. Ticketing ships with preset roles such as sd_admin, sd_technician, sd_user, and kb_admin. Platform staff roles (platform_super_admin / platform_agent) are peers of each other—not a hierarchy above org roles—and enter a tenant via MSP context.",
  example: {
    title: "Service desk technician role",
    narrative:
      "Admin creates role “SD Technician” with org.ticketing.tickets and related desk permissions, adds lee@acme.test as an employee with that role, and verifies Lee can triage incidents but cannot change branding under Settings. Separately, a new hire added with the default learner role opens /portal and sees their courses without any operator access.",
  },
  steps: [
    {
      title: "Review employees and their roles",
      body: "On Employees, the Role column shows each sign-in's role. Confirm who already has org_admin, learner, or custom roles in the tenant.",
      href: "/org/targets",
    },
    {
      title: "Open Roles",
      body: "Inspect the permission catalog and clone or create a role that matches the job.",
      href: "/org/roles",
    },
    {
      title: "Assign ticketing presets carefully",
      body: "Use sd_* / kb_admin presets when the person only needs service-desk scope.",
    },
    {
      title: "Add the employee with the right role",
      body: "Add an employee on Employees and pick its role (the default is learner). The sign-in is created and invited automatically; for operators, pick a role with only the permissions they need.",
    },
    {
      title: "Verify least privilege",
      body: "Sign in as that user (or review permissions) to ensure Settings and Employees stay locked down for non-admins. MFA remains available to every logged-in org user.",
    },
  ],
  diagram: {
    title: "Access model",
    nodes: [
      { id: "user", label: "Sign-in (login)" },
      { id: "role", label: "Role" },
      { id: "perms", label: "Permissions" },
      { id: "modules", label: "Org modules" },
      { id: "target", label: "Employee" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "linked sign-in" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Employees",
    stats: [
      { label: "Employees", value: "9" },
      { label: "Custom roles", value: "4" },
      { label: "Presets", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Tickets + desks · no settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner" },
    ],
    annotations: [
      { label: "Catalog", note: "Permissions are enforced on /api/v1/org/*." },
      { label: "Employees", note: "Each employee has a sign-in; its role is set on the Employees list." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
