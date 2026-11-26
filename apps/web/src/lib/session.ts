export type OrgMembership = {
  tenant_id: string;
  name: string;
  department_id?: number | null;
  department?: string | null;
};

export type SubscriptionStatus = "trial" | "active" | "suspended" | "expired";

export type SubscriptionUsageItem = {
  used: number;
  /** Null when the plan does not limit this resource. */
  limit: number | null;
  over_limit: boolean;
};

/** Plan, status and usage for the active organization, from /auth/me. */
export type SessionSubscription = {
  plan_name: string | null;
  status: SubscriptionStatus | null;
  effective_status: SubscriptionStatus | null;
  /** True when org writes are blocked (expired, suspended, or a trial/term that has ended). */
  read_only: boolean;
  /** Trial end while trialing, term end while active. */
  ends_at: string | null;
  over_limit: boolean;
  usage: {
    employees: SubscriptionUsageItem;
    users: SubscriptionUsageItem;
  };
  /** Plan feature flags the organization workspace and employee experience depend on. */
  features?: {
    learner_portal: boolean;
    knowledge_base?: boolean;
  };
};

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  tenant_id: string | null;
  department_id?: number | null;
  department?: string | null;
  job_title?: string | null;
  target_department?: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
  roles: string[];
  permissions: string[];
  /** True when the user holds any organization console permission (`/org`), not only the employee portal. */
  has_org_access?: boolean;
  is_platform_staff: boolean;
  mfa_enabled?: boolean;
  /** True when an authenticator app (TOTP) is connected; passkeys are tracked separately. */
  mfa_totp_enabled?: boolean;
  locale?: string | null;
  staff_tenant_id?: string | null;
  acting_in_tenant?: boolean;
  memberships?: OrgMembership[];
  needs_org_selection?: boolean;
  active_tenant_id?: string | null;
  subscription?: SessionSubscription | null;
};

export type OrgMembershipMatch =
  | { ok: true }
  | { ok: false; kind: "org_mismatch"; homeTenant: string }
  | { ok: false; kind: "staff_enter_required" }
  | { ok: false; kind: "org_selection_required" };

export type StaffGateUser = Pick<SessionUser, "is_platform_staff">;

export type PostLoginUser = Pick<
  SessionUser,
  | "is_platform_staff"
  | "tenant_id"
  | "memberships"
  | "needs_org_selection"
  | "has_org_access"
>;

/**
 * The API is the single source of truth: while acting in a tenant, `permissions`
 * already contains exactly what the Gate allows (see UserResource /
 * OrgPermissionCatalog::staffTenantPermissionsFor).
 */
export function hasPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}

/** True when the user holds at least one of the listed permissions (e.g. VIEW or MANAGE). */
export function hasAnyPermission(user: SessionUser | null, permissions: readonly string[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canAccessMsp(user: StaffGateUser): boolean {
  return user.is_platform_staff === true;
}

export function activeMemberships(user: PostLoginUser): OrgMembership[] {
  return (user.memberships ?? []).filter((m) => Boolean(m.tenant_id));
}

export function defaultPostLoginPath(user: PostLoginUser): string {
  if (canAccessMsp(user)) {
    return "/msp";
  }
  // Trust API flag: multi-org users with an active org already selected
  // have needs_org_selection=false and must not loop back to /select-org.
  if (user.needs_org_selection) {
    return "/select-org";
  }
  // Org admins land in the organization console; employees (learners, or users without
  // console permissions) land in the employee dashboard at /portal.
  return user.has_org_access === true ? "/org" : "/portal";
}

function isMspPath(path: string): boolean {
  return path === "/msp" || path.startsWith("/msp/");
}

function isSelectOrgPath(path: string): boolean {
  return path === "/select-org" || path.startsWith("/select-org/");
}

/**
 * Resolve post-login destination. Honors a same-origin relative `next` unless
 * it targets /msp for a non-staff user, or skips org selection when required.
 */
export function resolvePostLoginPath(
  user: PostLoginUser,
  next?: string | null,
): string {
  const needsSelection =
    !canAccessMsp(user) && user.needs_org_selection === true;

  if (needsSelection) {
    if (next && next.startsWith("/") && !next.startsWith("//") && !isMspPath(next)) {
      return `/select-org?next=${encodeURIComponent(next)}`;
    }
    return "/select-org";
  }

  if (next && next.startsWith("/") && !next.startsWith("//")) {
    if (isMspPath(next) && !canAccessMsp(user)) {
      return defaultPostLoginPath(user);
    }
    if (isSelectOrgPath(next) && activeMemberships(user).length <= 1) {
      return defaultPostLoginPath(user);
    }
    return next;
  }
  return defaultPostLoginPath(user);
}

/**
 * Whether the signed-in user may operate in `currentTenant` (same rules as
 * EnsureOrgMembership / StaffTenant::matches on the API).
 */
export function matchOrgMembership(
  user: SessionUser,
  currentTenant: string,
): OrgMembershipMatch {
  const tenant = currentTenant.trim();
  if (!tenant) {
    return { ok: false, kind: "staff_enter_required" };
  }

  if (user.is_platform_staff) {
    if (user.staff_tenant_id === tenant) {
      return { ok: true };
    }
    return { ok: false, kind: "staff_enter_required" };
  }

  const memberships = activeMemberships(user);
  if (memberships.some((m) => m.tenant_id === tenant)) {
    return { ok: true };
  }

  if (user.tenant_id === tenant) {
    return { ok: true };
  }

  if (memberships.length > 1) {
    return { ok: false, kind: "org_selection_required" };
  }

  if (user.tenant_id) {
    return { ok: false, kind: "org_mismatch", homeTenant: user.tenant_id };
  }

  if (memberships.length === 1) {
    return { ok: false, kind: "org_mismatch", homeTenant: memberships[0].tenant_id };
  }

  return { ok: false, kind: "org_selection_required" };
}
