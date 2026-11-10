import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Users & roles",
  summary:
    "Invite org operators and learners, craft custom roles, and map the permission catalog—including ticketing presets.",
  keywords: ["users", "roles", "rbac", "permissions", "sd_admin", "learner", "access"],
  openInAppHref: "/org/users",
  overview:
    "Org login users include operators (org_admin and custom roles) and employees. Each Employee (Target) is paired with a User that typically holds the learner role so they can sign in to /learn and the service portal. Use Users to invite people and Roles to compose permissions across training, checklists, ticketing, reports, settings, and announcements. Ticketing ships with preset roles such as sd_admin, sd_technician, sd_user, and kb_admin. Platform staff roles (platform_super_admin / platform_agent) are peers of each other—not a hierarchy above org roles—and enter a tenant via MSP context.",
  example: {
    title: "Service desk technician role",
    narrative:
      "Admin creates role “SD Technician” with org.ticketing.tickets and related desk permissions, invites lee@acme.test, and verifies Lee can triage incidents but cannot change branding under Settings. Separately, a new hire on Employees gets a paired learner User and can open /learn without appearing as an org operator.",
  },
  steps: [
    {
      title: "Review existing users",
      body: "Confirm who already has org_admin, learner, or custom roles in the tenant.",
      href: "/org/users",
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
      title: "Invite the operator or rely on employee pairing",
      body: "Create an operator on Users with the right role, or add an Employee so ProvisionEmployeePair creates the paired learner User/login.",
    },
    {
      title: "Verify least privilege",
      body: "Sign in as that user (or review permissions) to ensure Settings and Users stay locked down for non-admins. MFA remains available to every logged-in org user.",
    },
  ],
  diagram: {
    title: "Access model",
    nodes: [
      { id: "user", label: "User (login)" },
      { id: "role", label: "Role" },
      { id: "perms", label: "Permissions" },
      { id: "modules", label: "Org modules" },
      { id: "target", label: "Target / employee" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "paired learner" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Roles",
    stats: [
      { label: "Users", value: "9" },
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
      { title: "maya@acme.test", meta: "learner · paired Target" },
    ],
    annotations: [
      { label: "Catalog", note: "Permissions are enforced on /api/v1/org/*." },
      { label: "Employees", note: "Employees are login users via Target↔User pairing (learner)." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
