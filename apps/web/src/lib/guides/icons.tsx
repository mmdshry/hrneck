import {
  BarChart3,
  BookMarked,
  BookOpen,
  Building2,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Info,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  ListOrdered,
  Megaphone,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Ticket,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { GuideSlug } from "@/lib/guides/types";

const GUIDE_ICONS: Record<GuideSlug, LucideIcon> = {
  "getting-started": Rocket,
  dashboard: LayoutDashboard,
  "targets-groups": Target,
  training: GraduationCap,
  checklists: ClipboardList,
  ticketing: Ticket,
  reporting: BarChart3,
  "users-roles": Users,
  "announcements-notifications": Megaphone,
  settings: Settings2,
  "learner-portal": BookMarked,
  "service-portal": LifeBuoy,
  msp: Building2,
  auth: ShieldCheck,
};

export const guidesHubIcon = BookOpen;
export const guidesOverviewIcon = Info;
export const guidesStepsIcon = ListOrdered;
export const guidesExampleIcon = Sparkles;
export const guidesRelatedIcon = Link2;
export const guidesOpenInAppIcon = ExternalLink;
export const guidesSearchIcon = Search;
export const guidesDiagramIcon = Workflow;

export function guideIcon(slug: GuideSlug): LucideIcon {
  return GUIDE_ICONS[slug];
}
