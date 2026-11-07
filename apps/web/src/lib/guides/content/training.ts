import type { GuideModule } from "@/lib/guides/types";

export const trainingGuide: GuideModule = {
  slug: "training",
  title: "Security awareness training",
  summary:
    "Assign courses and media, run campaigns with reminders, and track lesson progress plus watch time.",
  keywords: ["training", "lms", "campaign", "course", "quiz", "assign", "reminder"],
  openInAppHref: "/org/training",
  overview:
    "The training hub covers the course library (text, video, PDF lessons and quizzes), direct assignments to targets or groups, and training campaigns with email reminders. Admins review per-lesson progress and export CSV; learners consume assigned content in the learner portal.",
  example: {
    title: "Acme Finance Q4 awareness campaign",
    narrative:
      "Ops creates campaign “Security Awareness Q4”, selects the Phishing Essentials course, targets the Finance group (186 people), schedules weekly reminders, then watches completion climb from 12% to 86% on the campaign metrics page.",
  },
  steps: [
    {
      title: "Open the training hub",
      body: "Browse courses, assignments, and progress from Training.",
      href: "/org/training",
    },
    {
      title: "Assign content",
      body: "Assign a full course or a single article/video to selected targets and/or groups.",
    },
    {
      title: "Create a campaign",
      body: "Name the campaign, pick content, choose group_ids/targets, and enable reminder cadence.",
      href: "/org/training/campaigns",
    },
    {
      title: "Confirm delivery path",
      body: "Campaign emails use SMTP and the active sending profile. Verify Integrations first if mail is new.",
      href: "/org/settings/integrations",
    },
    {
      title: "Monitor metrics",
      body: "Track enrollment, lesson progress, watch time, and export CSV for stakeholders.",
    },
  ],
  diagram: {
    title: "Campaign lifecycle",
    nodes: [
      { id: "library", label: "Course library" },
      { id: "audience", label: "Targets / groups" },
      { id: "campaign", label: "Campaign" },
      { id: "mail", label: "Reminders" },
      { id: "metrics", label: "Progress + CSV" },
    ],
    edges: [
      { from: "library", to: "campaign" },
      { from: "audience", to: "campaign" },
      { from: "campaign", to: "mail" },
      { from: "mail", to: "metrics" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Training campaigns",
    stats: [
      { label: "Completion", value: "86%" },
      { label: "Assigned", value: "186" },
      { label: "Reminders", value: "Weekly" },
    ],
    highlight: {
      title: "Security Awareness Q4",
      caption: "Finance group · Phishing Essentials · 38 overdue",
      progress: 86,
    },
    rows: [
      { title: "Lesson 1 · Spot the lure", meta: "92% complete · 4m avg watch" },
      { title: "Quiz · Reporting phishing", meta: "81% pass rate" },
      { title: "Lesson 3 · Safe links", meta: "74% complete" },
    ],
    annotations: [
      { label: "Campaign card", note: "Metrics update live as learners finish lessons." },
      { label: "Reminders", note: "Email job uses the org SMTP pipeline." },
    ],
  },
  related: ["targets-groups", "settings", "reporting"],
};
