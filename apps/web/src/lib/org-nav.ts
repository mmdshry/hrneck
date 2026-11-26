import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  ContactRound,
  Download,
  FileText,
  GraduationCap,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  Megaphone,
  Send,
  Settings2,
  Shield,
  Ticket,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { hasAnyPermission, type SessionUser } from "@/lib/session";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Any one of these permissions shows the item (view or manage). */
  permissions?: readonly string[];
  /** Hidden when the plan explicitly disables this feature. */
  planFeature?: "knowledge_base";
  platformOnly?: boolean;
};

/** Organization console menu, in display order. */
export const ORG_NAV: NavItem[] = [
  { href: "/org", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/msp", label: "Organizations", icon: Building2, exact: true, platformOnly: true },
  { href: "/org/training", label: "Training", icon: GraduationCap, permissions: ["org.training.view", "org.training.manage"] },
  { href: "/org/courses", label: "Courses", icon: Library, permissions: ["org.training.view", "org.training.manage"] },
  { href: "/org/training/campaigns", label: "Campaigns", icon: Send, permissions: ["org.campaigns.view", "org.campaigns.manage"] },
  { href: "/org/checklists", label: "Checklists", icon: ClipboardList, permissions: ["org.checklists.view", "org.checklists.fill", "org.checklists.manage"] },
  { href: "/org/ticketing", label: "Ticketing", icon: Ticket, permissions: ["org.ticketing.tickets"] },
  { href: "/org/kb", label: "Knowledge base", icon: FileText, permissions: ["org.kb.view", "org.kb.manage"], planFeature: "knowledge_base" },
  {
    href: "/org/targets",
    label: "Employees",
    icon: ContactRound,
    permissions: ["org.targets.view", "org.targets.manage", "org.users.view", "org.users.manage"],
  },
  { href: "/org/departments", label: "Departments", icon: Layers, permissions: ["org.departments.view", "org.departments.manage"] },
  { href: "/org/groups", label: "Groups", icon: UsersRound, permissions: ["org.groups.view", "org.groups.manage"] },
  { href: "/org/roles", label: "Roles", icon: KeyRound, permissions: ["org.roles.manage"] },
  { href: "/org/reports", label: "Reporting", icon: BarChart3, permissions: ["org.reports.view"] },
  { href: "/org/reports/export", label: "Export", icon: Download, permissions: ["org.reports.export"] },
  { href: "/org/announcements", label: "Announcements", icon: Megaphone, permissions: ["org.announcements.manage"] },
  { href: "/org/audit", label: "Audit log", icon: History, permissions: ["org.audit.view"] },
  { href: "/org/settings", label: "Settings", icon: Settings2, permissions: ["org.settings.view", "org.settings.manage"] },
  { href: "/org/settings/mfa", label: "Account / MFA", icon: Shield },
  { href: "/docs", label: "Guides", icon: BookOpen },
];

/** Items the user may see, in their declared order. */
export function visibleOrgNav(user: SessionUser | null): NavItem[] {
  return ORG_NAV.filter((item) => {
    if (item.platformOnly) {
      return Boolean(user?.is_platform_staff);
    }
    if (item.planFeature && user?.subscription?.features?.[item.planFeature] === false) {
      return false;
    }
    if (!item.permissions) {
      return true;
    }
    return hasAnyPermission(user, item.permissions);
  });
}
