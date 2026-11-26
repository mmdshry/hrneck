import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Learner portal",
  summary:
    "Complete assigned courses, watch lessons with recorded watch time, take quizzes, and follow training notifications from your employee dashboard at /portal.",
  keywords: [
    "learner",
    "learn",
    "dashboard",
    "quiz",
    "course",
    "enrollment",
    "watch time",
    "essay",
    "portal",
  ],
  openInAppHref: "/portal",
  overview:
    "Employees land on their dashboard at /portal after sign-in. My courses lists the security-awareness training assigned to them: operators assign courses from /org/training and learners open each course to see lessons, read articles, watch uploaded or embedded video (watch time is reported), view PDFs, mark lessons complete, and take quizzes with pass scores, optional flags, countdowns, and essay answers. The same dashboard links to My tickets and the Knowledge base. HR checklists never appear here. The notification bell surfaces training_assigned events with deep links back into /portal. The plan can switch My courses off; the rest of the dashboard still works.",
  example: {
    title: "Finance analyst finishes Phishing Essentials",
    narrative:
      "Maya opens /portal, sees Security Awareness Q4 under My courses at 40%, watches Lesson 2 (4 minutes recorded), marks it complete, then takes the required quiz with a 15-minute countdown. She passes at 88%, leaves an essay on “how she would report a lure”, and the org viewing report updates her row before the next reminder fires.",
  },
  steps: [
    {
      title: "Sign in on the tenant host",
      body: "Use your org account on {slug}.hrneck.test. MFA may be required. Learners do not use the MSP or Filament admin.",
      href: "/login",
    },
    {
      title: "Open your dashboard at /portal",
      body: "My courses lists assigned training with status and progress. Only enrollments created by Training assignments or campaigns appear. My tickets and Knowledge base are one click away.",
      href: "/portal",
    },
    {
      title: "Complete lessons",
      body: "Read articles, watch video (URL or upload), open PDFs, and mark each lesson complete when finished.",
    },
    {
      title: "Take quizzes",
      body: "Respect pass score, required vs optional, and any countdown. Answer multiple choice and unscored essays, then submit.",
    },
    {
      title: "Watch the notification bell",
      body: "New training assignments appear in the bell with a deep link into the course on your dashboard.",
    },
  ],
  sections: [
    {
      title: "What learners never see",
      steps: [
        {
          title: "No HR checklists",
          body: "Onboarding/offboarding forms are admin-only under /org/checklists. Employees are audience records; checklist instances are filled by HR operators.",
        },
        {
          title: "No org admin sidebar",
          body: "Course authoring, campaign launch, and viewing-report export stay in /org for users with org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Learner path",
    nodes: [
      { id: "assign", label: "Org assigns course" },
      { id: "learn", label: "My courses on /portal" },
      { id: "lesson", label: "Lesson" },
      { id: "quiz", label: "Quiz" },
      { id: "report", label: "Org viewing report" },
    ],
    edges: [
      { from: "assign", to: "learn" },
      { from: "learn", to: "lesson" },
      { from: "lesson", to: "quiz" },
      { from: "quiz", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Learner · My courses",
    stats: [
      { label: "Assigned", value: "2" },
      { label: "In progress", value: "1" },
      { label: "Completed", value: "1" },
    ],
    highlight: {
      title: "Phishing Essentials",
      caption: "Lesson 2 of 3 · 4m watched · quiz unlocked next",
      progress: 66,
    },
    rows: [
      { title: "Lesson 1 · Spot the lure", meta: "Complete" },
      { title: "Lesson 2 · Safe links", meta: "In progress · video" },
      { title: "Quiz · Reporting phishing", meta: "Required · 15m limit" },
    ],
    annotations: [
      { label: "Watch time", note: "Video progress reports back to the org viewing report." },
      { label: "Bell", note: "training_assigned notifications deep-link into /portal." },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
