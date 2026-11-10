export type SessionUser = {
  id: number;
  name: string;
  email: string;
  tenant_id: string | null;
  roles: string[];
  permissions: string[];
  is_platform_staff: boolean;
  mfa_enabled?: boolean;
  staff_tenant_id?: string | null;
  acting_in_tenant?: boolean;
};

export type OrgMembershipMatch =
  | { ok: true }
  | { ok: false; kind: "org_mismatch"; homeTenant: string }
  | { ok: false; kind: "staff_enter_required" };

export type StaffGateUser = Pick<SessionUser, "is_platform_staff">;

export function hasPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.acting_in_tenant) return true;
  return user.permissions.includes(permission);
}

export function canAccessMsp(user: StaffGateUser): boolean {
  return user.is_platform_staff === true;
}

export function defaultPostLoginPath(user: StaffGateUser): string {
  if (canAccessMsp(user)) {
    return "/msp";
  }
  return "/org";
}

function isMspPath(path: string): boolean {
  return path === "/msp" || path.startsWith("/msp/");
}

/**
 * Resolve post-login destination. Honors a same-origin relative `next` unless
 * it targets /msp for a non-staff user.
 */
export function resolvePostLoginPath(
  user: StaffGateUser,
  next?: string | null,
): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    if (isMspPath(next) && !canAccessMsp(user)) {
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

  if (user.is_platform_staff || user.tenant_id === null) {
    if (user.staff_tenant_id === tenant) {
      return { ok: true };
    }
    return { ok: false, kind: "staff_enter_required" };
  }

  if (user.tenant_id === tenant) {
    return { ok: true };
  }

  return { ok: false, kind: "org_mismatch", homeTenant: user.tenant_id };
}
