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
    "sso",
    "google",
    "microsoft",
    "passkey",
    "webauthn",
  ],
  openInAppHref: "/login",
  overview:
    "HRNECK uses cookie sessions on tenant hosts ({slug}.hrneck.test) and the app alias. Sign-in supports remember-me, an email-verification gate (admin-created users are typically already verified), Continue with Google or Microsoft for accounts an administrator already created, TOTP MFA or passkeys as the second factor with one-time recovery codes, and forgot/reset/change password flows. MFA setup, passkeys, and disable live under Settings → MFA for signed-in operators. Platform staff and org users share the same login pages but land on /msp or /org depending on role. Changing a password clears any staff tenant context.",
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
      body: "Use email and password with optional remember-me, or Continue with Google or Microsoft when that button appears. Unverified emails are blocked until verification completes.",
    },
    {
      title: "Complete MFA when challenged",
      body: "At /login/mfa, enter the code from your authenticator app, or choose Sign in with a passkey if you added one. If you lose both, use a one-time recovery code, then re-enroll MFA.",
      href: "/login/mfa",
    },
    {
      title: "Forgot or reset password",
      body: "Use /login/forgot to request a reset email, then /login/reset with the token. After a password change, re-enter any MSP tenant you had open.",
      href: "/login/forgot",
    },
    {
      title: "Manage MFA in Settings",
      body: "Signed-in operators set up, confirm, or disable MFA, add or remove passkeys, and view recovery codes. Removing a passkey asks for your account password. Disabling MFA asks for your password and a code or passkey, and it removes every passkey.",
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
          body: "platform_super_admin / platform_agent use /msp and optionally enter a tenant. Filament MFA on admin.hrneck.test supports only an authenticator app. Passkeys are not offered there yet.",
        },
        {
          title: "Learners and portal users",
          body: "Same login pages; after sign-in org admins open /org and everyone else opens their dashboard at /portal.",
        },
      ],
    },
    {
      title: "Sign-in options",
      steps: [
        {
          title: "Google or Microsoft (SSO)",
          body: "The login page shows Continue with Google or Continue with Microsoft only when your organization has that provider set up. SSO works only for accounts an administrator already created: it never creates a user, and it matches an existing account by email only when the provider confirms that address. Your identity provider handles MFA, so HRNECK's MFA prompt does not appear after SSO. Password sign-in stays available next to SSO.",
        },
        {
          title: "Passkeys",
          body: "A passkey, such as one on this device or a security key, can be your second factor on /login/mfa next to the authenticator app. Add passkeys under Settings → MFA. The first factor you add turns MFA on and shows recovery codes once, so save them. Passkeys need a secure connection (https:// or localhost) and do not work on a tenant's custom domain.",
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
      { title: "/login/mfa", meta: "TOTP · passkey · recovery codes" },
      { title: "/login/forgot", meta: "Reset email" },
    ],
    annotations: [
      { label: "Verification", note: "Unverified users cannot pass the login gate." },
      { label: "Staff context", note: "Password change clears MSP enter state." },
    ],
  },
  related: ["getting-started", "msp", "settings", "learner-portal"],
};
