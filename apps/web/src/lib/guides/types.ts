export const GUIDE_SLUGS = [
  "getting-started",
  "dashboard",
  "targets-groups",
  "training",
  "checklists",
  "ticketing",
  "reporting",
  "users-roles",
  "announcements-notifications",
  "settings",
  "learner-portal",
  "service-portal",
  "msp",
  "auth",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export type GuideStep = {
  title: string;
  body: string;
  href?: string;
};

export type GuideSection = {
  title: string;
  body?: string;
  steps: GuideStep[];
};

export type GuideDiagramNode = {
  id: string;
  label: string;
};

export type GuideDiagramEdge = {
  from: string;
  to: string;
  label?: string;
};

export type GuideDiagram = {
  title: string;
  nodes: GuideDiagramNode[];
  edges: GuideDiagramEdge[];
};

export type GuideMockStat = {
  label: string;
  value: string;
};

export type GuideMockRow = {
  title: string;
  meta: string;
};

export type GuideMockAnnotation = {
  label: string;
  note: string;
};

export type GuideMock = {
  chromeTitle: string;
  stats: GuideMockStat[];
  highlight: {
    title: string;
    caption: string;
    progress?: number;
  };
  rows: GuideMockRow[];
  annotations: GuideMockAnnotation[];
};

export type GuideExample = {
  title: string;
  narrative: string;
};

export type GuideModule = {
  slug: GuideSlug;
  title: string;
  summary: string;
  keywords: string[];
  openInAppHref?: string;
  overview: string;
  example: GuideExample;
  steps: GuideStep[];
  sections?: GuideSection[];
  diagram: GuideDiagram;
  mock: GuideMock;
  related: GuideSlug[];
};
