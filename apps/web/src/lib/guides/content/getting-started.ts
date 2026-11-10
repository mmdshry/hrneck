import type { GuideModule } from "@/lib/guides/types";

export const gettingStartedGuide: GuideModule = {
  slug: "getting-started",
  title: "Getting started",
  summary:
    "Sign in as an org admin, learn the tenant shell, and follow the recommended first-week path.",
  keywords: ["onboarding", "login", "demo", "roles", "hosts", "start"],
  openInAppHref: "/org",
  overview:
    "HRNECK tenant workspaces run on {slug}.hrneck.test (or the app.hrneck.test alias). Org admins use the left sidebar to manage training, employees, checklists, ticketing, reporting, users, and settings. Guides stay public so you can review workflows before signing in.",
  example: {
    title: "Acme Corp first login",
    narrative:
      "Sara (org_admin@acme.test) opens acme.hrneck.test, signs in with her MFA-backed account, lands on the org dashboard, and uses Guides to confirm SMTP and employees before launching the Q4 awareness campaign.",
  },
  steps: [
    {
      title: "Open your tenant host",
      body: "Use {slug}.hrneck.test for your organization. Local demo tenants include itneck, test, and company.",
    },
    {
      title: "Sign in as org admin",
      body: "Use an org_admin account such as admin@{tenant}.test. Platform staff (admin@hrneck.test) use MSP → Open tenant admin, which enters a real staff tenant context before /org loads.",
      href: "/login",
    },
    {
      title: "Scan the sidebar",
      body: "Dashboard, Training, Checklists, Ticketing, Employees, Departments, Groups, Users, Roles, Reporting, Announcements, and Settings map 1:1 to tenant capabilities.",
      href: "/org",
    },
    {
      title: "Follow the start-here path",
      body: "Import employees → verify SMTP → connect onboarding packs/checklists → assign a training campaign → open Reporting. Each step has a dedicated guide.",
    },
    {
      title: "Invite operators with roles",
      body: "Create custom roles with the permission catalog before handing work to technicians or trainers.",
      href: "/org/roles",
    },
  ],
  diagram: {
    title: "Operator first-week path",
    nodes: [
      { id: "login", label: "Sign in" },
      { id: "targets", label: "Import employees" },
      { id: "smtp", label: "Verify SMTP" },
      { id: "campaign", label: "Launch campaign" },
      { id: "report", label: "Review reports" },
    ],
    edges: [
      { from: "login", to: "targets" },
      { from: "targets", to: "smtp" },
      { from: "smtp", to: "campaign" },
      { from: "campaign", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Getting started checklist",
    stats: [
      { label: "Employees", value: "0 → 186" },
      { label: "SMTP", value: "Connected" },
      { label: "Campaigns", value: "Ready" },
    ],
    highlight: {
      title: "Week 1 setup",
      caption: "3 of 4 setup tasks complete · launch campaign next",
      progress: 75,
    },
    rows: [
      { title: "Import Finance + Ops employees", meta: "Done · CSV" },
      { title: "Confirm mail.hrneck.com SMTP", meta: "Done · Integrations" },
      { title: "Create Security Awareness Q4", meta: "Next · Campaigns" },
    ],
    annotations: [
      { label: "Sidebar", note: "Guides stay visible even before sign-in." },
      { label: "Open in app", note: "Deep links jump to the live org route when authenticated." },
    ],
  },
  related: ["auth", "targets-groups", "settings", "training", "msp"],
};
