import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Users & roles",
  summary:
    "Invite org operators, craft custom roles, and map the permission catalog—including ticketing presets.",
  keywords: ["users", "roles", "rbac", "permissions", "sd_admin", "access"],
  openInAppHref: "/org/users",
  overview:
    "Org users are operators with RBAC permissions inside a single tenant. Employees (Targets) are not login users. Use Users to invite operators and Roles to compose permissions across training, checklists, ticketing, reports, settings, and announcements. Ticketing ships with preset roles such as sd_admin, sd_technician, sd_user, and kb_admin.",
  example: {
    title: "Service desk technician role",
    narrative:
      "Admin creates role “SD Technician” with org.ticketing.tickets and related desk permissions, invites lee@acme.test, and verifies Lee can triage incidents but cannot change branding under Settings.",
  },
  steps: [
    {
      title: "Review existing users",
      body: "Confirm who already has org_admin or custom roles in the tenant.",
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
      title: "Invite the operator",
      body: "Create the user, attach the role, and have them sign in on the tenant host.",
    },
    {
      title: "Verify least privilege",
      body: "Sign in as that user (or review permissions) to ensure Settings and Users stay locked down.",
    },
  ],
  diagram: {
    title: "Access model",
    nodes: [
      { id: "user", label: "Org user" },
      { id: "role", label: "Role" },
      { id: "perms", label: "Permissions" },
      { id: "modules", label: "Org modules" },
      { id: "targets", label: "Targets (no login)" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "targets", to: "modules", label: "audience only" },
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
      { title: "kb.editor@acme.test", meta: "kb_admin" },
    ],
    annotations: [
      { label: "Catalog", note: "Permissions are enforced on /api/v1/org/*." },
      { label: "Targets", note: "Employees never appear in Users—only in Targets." },
    ],
  },
  related: ["ticketing", "settings", "getting-started"],
};
