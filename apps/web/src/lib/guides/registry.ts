import { announcementsNotificationsGuide } from "@/lib/guides/content/announcements-notifications";
import { authGuide } from "@/lib/guides/content/auth";
import { checklistsGuide } from "@/lib/guides/content/checklists";
import { dashboardGuide } from "@/lib/guides/content/dashboard";
import { gettingStartedGuide } from "@/lib/guides/content/getting-started";
import { learnerPortalGuide } from "@/lib/guides/content/learner-portal";
import { mspGuide } from "@/lib/guides/content/msp";
import { reportingGuide } from "@/lib/guides/content/reporting";
import { servicePortalGuide } from "@/lib/guides/content/service-portal";
import { settingsGuide } from "@/lib/guides/content/settings";
import { targetsGroupsGuide } from "@/lib/guides/content/targets-groups";
import { ticketingGuide } from "@/lib/guides/content/ticketing";
import { trainingGuide } from "@/lib/guides/content/training";
import { usersRolesGuide } from "@/lib/guides/content/users-roles";
import {
  GUIDE_SLUGS,
  type GuideModule,
  type GuideSlug,
} from "@/lib/guides/types";

const GUIDES: GuideModule[] = [
  gettingStartedGuide,
  dashboardGuide,
  targetsGroupsGuide,
  trainingGuide,
  checklistsGuide,
  ticketingGuide,
  reportingGuide,
  usersRolesGuide,
  announcementsNotificationsGuide,
  settingsGuide,
  learnerPortalGuide,
  servicePortalGuide,
  mspGuide,
  authGuide,
];

const BY_SLUG = new Map<GuideSlug, GuideModule>(
  GUIDES.map((guide) => [guide.slug, guide]),
);

export function listGuides(): GuideModule[] {
  return GUIDES;
}

export function getGuide(slug: string): GuideModule | undefined {
  if (!isGuideSlug(slug)) {
    return undefined;
  }
  return BY_SLUG.get(slug);
}

export function isGuideSlug(value: string): value is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(value);
}

export function getAdjacentGuides(slug: GuideSlug): {
  previous: GuideModule | null;
  next: GuideModule | null;
} {
  const index = GUIDES.findIndex((guide) => guide.slug === slug);
  if (index < 0) {
    return { previous: null, next: null };
  }
  return {
    previous: index > 0 ? (GUIDES[index - 1] ?? null) : null,
    next: index < GUIDES.length - 1 ? (GUIDES[index + 1] ?? null) : null,
  };
}

export function searchGuides(query: string): GuideModule[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return GUIDES;
  }
  return GUIDES.filter((guide) => {
    const sectionText = (guide.sections ?? []).flatMap((section) => [
      section.title,
      section.body ?? "",
      ...section.steps.flatMap((step) => [step.title, step.body]),
    ]);
    const haystack = [
      guide.title,
      guide.summary,
      guide.overview,
      ...guide.keywords,
      ...guide.steps.flatMap((step) => [step.title, step.body]),
      ...sectionText,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function guideHref(slug: GuideSlug): string {
  return `/docs/${slug}`;
}
