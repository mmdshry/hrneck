import { FileText, GraduationCap, Shield, Ticket } from "lucide-react";
import { type NavItem, visibleOrgNav } from "@/lib/org-nav";
import type { SessionUser } from "@/lib/session";

export type PortalNavLabels = {
  myCourses: string;
  myTickets: string;
  knowledgeBase: string;
  accountMfa: string;
};

/** Org console entry that has a portal copy at /portal/account; it is not listed in the org section. */
const ORG_ACCOUNT_HREF = "/org/settings/mfa";

/**
 * Sidebar menu for /portal: the employee's own pages first, then every organization
 * console item the user may open. The org Dashboard is only added for org users, since
 * employees without console access would land on an empty page.
 */
export function buildPortalNav(
  user: SessionUser | null,
  labels: PortalNavLabels,
): NavItem[] {
  const ownItems: NavItem[] = [];
  // Hidden only when the plan explicitly disables the learner portal.
  if (user?.subscription?.features?.learner_portal !== false) {
    ownItems.push({
      href: "/portal",
      label: labels.myCourses,
      icon: GraduationCap,
      exact: true,
    });
  }
  ownItems.push(
    { href: "/portal/tickets", label: labels.myTickets, icon: Ticket },
    { href: "/portal/kb", label: labels.knowledgeBase, icon: FileText },
    { href: "/portal/account", label: labels.accountMfa, icon: Shield },
  );

  const orgItems = visibleOrgNav(user).filter(
    (item) =>
      item.href !== ORG_ACCOUNT_HREF &&
      (item.href !== "/org" || user?.has_org_access === true),
  );

  return [...ownItems, ...orgItems];
}
