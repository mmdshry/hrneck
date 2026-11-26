import { hasAnyPermission, type SessionUser } from "@/lib/session";

export type EndUserNavItem = {
  href: string;
  label: string;
  /** Show the item only when the user holds at least one of these permissions. */
  requiresAnyPermission?: readonly string[];
  /** Hide the item when the plan does not include the learner portal (assigned courses). */
  requiresLearnerPortal?: boolean;
  /** Active only on this exact path, so a section root like `/portal` is not active on `/portal/tickets`. */
  exact?: boolean;
};

/** Permissions that expose the technician (ticketing operator) entry. */
export const TECHNICIAN_PERMISSIONS = [
  "org.ticketing.tickets",
  "org.ticketing.admin",
] as const;

/** Items the user may see, in their declared order. */
export function visibleEndUserNav(
  items: readonly EndUserNavItem[],
  user: SessionUser | null,
): EndUserNavItem[] {
  return items.filter((item) => {
    if (item.requiresLearnerPortal && user?.subscription?.features?.learner_portal === false) {
      return false;
    }
    return (
      !item.requiresAnyPermission ||
      hasAnyPermission(user, item.requiresAnyPermission)
    );
  });
}

/**
 * Exact match, or any nested route: `/portal/tickets/12` is active for `/portal/tickets`.
 * `exact` items only match their own path.
 */
export function isEndUserNavActive(
  pathname: string,
  href: string,
  exact = false,
): boolean {
  if (pathname === href) return true;
  return !exact && pathname.startsWith(`${href}/`);
}
