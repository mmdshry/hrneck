export type SessionUser = {
  id: number;
  name: string;
  email: string;
  tenant_id: string | null;
  roles: string[];
  permissions: string[];
  is_platform_staff: boolean;
  mfa_enabled?: boolean;
};

export function hasPermission(user: SessionUser | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}

export function defaultPostLoginPath(user: SessionUser): string {
  if (user.is_platform_staff || user.tenant_id === null) {
    return "/msp";
  }
  return "/org";
}
