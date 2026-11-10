import type { GuideModule } from "@/lib/guides/types";

export const mspGuide: GuideModule = {
  slug: "msp",
  title: "MSP console",
  summary:
    "Browse tenant organizations as platform staff, open a tenant admin context, and exit back to the MSP directory.",
  keywords: [
    "msp",
    "platform",
    "tenant",
    "organizations",
    "staff",
    "enter",
    "exit",
    "platform_super_admin",
    "platform_agent",
  ],
  openInAppHref: "/msp",
  overview:
    "The MSP console at /msp is for platform staff only (platform_super_admin and platform_agent). It lists tenant organizations with industry, employee band, status, and training flags, and lets staff Open tenant admin—which enters a real staff_tenant_id context so /org loads for that customer. Use Exit tenant in the org shell banner to return to /msp. Filament at admin.hrneck.test/admin is a separate staff surface (health, activity log, tenant switcher, deeper ops) and is not covered by this guide.",
  example: {
    title: "Staff helps Acme before Q4 launch",
    narrative:
      "Platform agent Jordan opens /msp, finds Acme (active, 100–249 employees, training on), clicks Open tenant admin, lands on /org with full permissions, verifies SMTP under Settings, then chooses Exit tenant and returns to the MSP directory.",
  },
  steps: [
    {
      title: "Sign in as platform staff",
      body: "Use a platform account such as admin@hrneck.test. Org-only users cannot open /msp.",
      href: "/login",
    },
    {
      title: "Open the MSP directory",
      body: "Review tenants: name, industry, employee band (1–10 through 500+), active/inactive, and training on/off. Hosts follow {slug}.hrneck.test.",
      href: "/msp",
    },
    {
      title: "Open tenant admin",
      body: "Enter the selected tenant. The Next org app loads with staff tenant context and treats you as having every org permission while inside.",
    },
    {
      title: "Work inside /org",
      body: "Use the normal org sidebar (training, employees, ticketing, settings, and so on). Live metrics and Guides behave like an org_admin session.",
      href: "/org",
    },
    {
      title: "Exit tenant",
      body: "Use the Exit tenant banner control to clear staff context and return to /msp. Changing your password also clears staff tenant context.",
    },
  ],
  sections: [
    {
      title: "MSP vs Filament vs org",
      steps: [
        {
          title: "MSP = directory + enter",
          body: "Next /msp is the lightweight staff directory and entry point into the customer org UI.",
        },
        {
          title: "Filament = central ops",
          body: "admin.hrneck.test/admin adds platform health, activity log, organizations CRUD, and tenant-ops resources after a Filament tenant switch. Customers never see Filament.",
        },
        {
          title: "Org users stay on their host",
          body: "org_admin accounts sign in on {slug}.hrneck.test and never need MSP enter/exit.",
        },
      ],
    },
  ],
  diagram: {
    title: "Staff tenant context",
    nodes: [
      { id: "login", label: "Platform login" },
      { id: "msp", label: "/msp directory" },
      { id: "enter", label: "Enter tenant" },
      { id: "org", label: "/org workspace" },
      { id: "exit", label: "Exit tenant" },
    ],
    edges: [
      { from: "login", to: "msp" },
      { from: "msp", to: "enter" },
      { from: "enter", to: "org" },
      { from: "org", to: "exit" },
      { from: "exit", to: "msp" },
    ],
  },
  mock: {
    chromeTitle: "HRNECK · MSP · Organizations",
    stats: [
      { label: "Tenants", value: "3" },
      { label: "Active", value: "3" },
      { label: "Context", value: "None" },
    ],
    highlight: {
      title: "Acme Corp",
      caption: "100–249 · training on · Open tenant admin",
      progress: 100,
    },
    rows: [
      { title: "acme.hrneck.test", meta: "Active · industry Services" },
      { title: "itneck.hrneck.test", meta: "Demo tenant" },
      { title: "Exit tenant", meta: "Shown only while inside /org" },
    ],
    annotations: [
      { label: "Enter", note: "Sets staff_tenant_id before /org loads." },
      { label: "Scope", note: "Only platform_super_admin / platform_agent see /msp." },
    ],
  },
  related: ["getting-started", "auth", "settings", "users-roles"],
};
