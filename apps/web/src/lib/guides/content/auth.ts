import type { GuideModule } from "@/lib/guides/types";

export const authGuide: GuideModule = {
  slug: "auth",
  title: "Sign-in, MFA & password",
  summary:
    "Sign in on the right host, complete MFA, reset a forgotten password, and understand email verification and recovery codes.",
  keywords: [
    "login",
    "mfa",
    "password",
    "forgot",
    "reset",
    "recovery",
    "verification",
    "session",
    "totp",
  ],
  openInAppHref: "/login",
  overview:
    "HRNECK uses cookie sessions on tenant hosts ({slug}.hrneck.test) and the app alias. Sign-in supports remember-me, an email-verification gate (admin-created users are typically already verified), TOTP MFA with one-time recovery codes, and forgot/reset/change password flows. MFA setup and disable live under Settings → MFA for signed-in operators. Platform staff and org users share the same login pages but land on /msp or /org depending on role. Changing a password clears any staff tenant context.",
  example: {
    title: "Org admin recovers access before launch",
    narrative:
      "Sara forgets her password the morning of Q4 launch, uses /login/forgot, resets from the email link, signs in, completes /login/mfa with her authenticator, and stores new recovery codes from Settings → MFA before assigning the campaign.",
  },
  steps: [
    {
      title: "Open the correct host",
      body: "Org users use {slug}.hrneck.test. Local demo tenants include itneck, test, and company. Platform staff may use the central host and then MSP.",
      href: "/login",
    },
    {
      title: "Sign in",
      body: "Email and password with optional remember-me. Unverified emails are blocked until verification completes.",
    },
    {
      title: "Complete MFA when challenged",
      body: "Enter the TOTP code at /login/mfa. If you lose the authenticator, use a one-time recovery code, then re-enroll MFA.",
      href: "/login/mfa",
    },
    {
      title: "Forgot or reset password",
      body: "Use /login/forgot to request a reset email, then /login/reset with the token. After a password change, re-enter any MSP tenant you had open.",
      href: "/login/forgot",
    },
    {
      title: "Manage MFA in Settings",
      body: "Signed-in operators set up, confirm, or disable MFA and view recovery codes under Settings → MFA.",
      href: "/org/settings/mfa",
    },
  ],
  sections: [
    {
      title: "Who lands where",
      steps: [
        {
          title: "Org operators",
          body: "org_admin and custom roles land in /org on their tenant host after MFA.",
        },
        {
          title: "Platform staff",
          body: "platform_super_admin / platform_agent use /msp and optionally enter a tenant. Filament MFA uses the same authenticator columns on admin.hrneck.test.",
        },
        {
          title: "Learners and portal users",
          body: "Same login pages; after session creation they open /learn or /portal based on permissions and enrollment.",
        },
      ],
    },
  ],
  diagram: {
    title: "Auth path",
    nodes: [
      { id: "host", label: "Tenant host" },
      { id: "login", label: "Login" },
      { id: "mfa", label: "MFA challenge" },
      { id: "app", label: "Org / MSP / Learn" },
      { id: "reset", label: "Forgot / reset" },
    ],
    edges: [
      { from: "host", to: "login" },
      { from: "login", to: "mfa" },
      { from: "mfa", to: "app" },
      { from: "login", to: "reset" },
      { from: "reset", to: "login" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Sign in",
    stats: [
      { label: "MFA", value: "Required" },
      { label: "Session", value: "Cookie" },
      { label: "Host", value: "acme.hrneck.test" },
    ],
    highlight: {
      title: "Authenticator challenge",
      caption: "Enter 6-digit code or a recovery code",
      progress: 100,
    },
    rows: [
      { title: "/login", meta: "Email + password" },
      { title: "/login/mfa", meta: "TOTP · recovery codes" },
      { title: "/login/forgot", meta: "Reset email" },
    ],
    annotations: [
      { label: "Verification", note: "Unverified users cannot pass the login gate." },
      { label: "Staff context", note: "Password change clears MSP enter state." },
    ],
  },
  related: ["getting-started", "msp", "settings", "learner-portal"],
};
