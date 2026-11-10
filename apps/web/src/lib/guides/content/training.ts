import type { GuideModule } from "@/lib/guides/types";

export const trainingGuide: GuideModule = {
  slug: "training",
  title: "Security awareness training",
  summary:
    "Build courses and quizzes, assign content, run reminder campaigns, and export lesson-level progress for stakeholders.",
  keywords: [
    "training",
    "lms",
    "campaign",
    "course",
    "quiz",
    "assign",
    "reminder",
    "watch time",
    "essay",
    "pdf export",
    "cancel",
    "archive",
  ],
  openInAppHref: "/org/training",
  overview:
    "Courses holds the library (article, video, and PDF lessons plus quizzes). Training assigns one or more courses to employees and/or groups, runs campaigns that queue a one-shot email reminder per recipient on launch (via SMTP and sending profiles), and reviews per-lesson progress with CSV or PDF export. Learners consume assigned content in the learner portal at /learn—not in the org queue. A secondary sample list at /org/campaigns exists for quick demos; the operator workflow lives under Training → Campaigns.",
  example: {
    title: "Acme Finance Q4 awareness campaign",
    narrative:
      "Ops builds Phishing Essentials with three lessons and a required quiz (80% pass, 15-minute limit, one essay). From Training they assign the course to the Finance group (186 people), launch Security Awareness Q4 (one reminder email queued per recipient), watch completion climb from 12% to 86%, then export the viewing report PDF for leadership.",
  },
  steps: [
    {
      title: "Build the course library",
      body: "Create courses and lessons on Courses before you assign anything. Add quizzes with a pass score, required flag, time limit, multiple choice, and optional essay questions.",
      href: "/org/courses",
    },
    {
      title: "Assign content",
      body: "On Training, select one or more courses and assign them to employees and/or groups. Learners see enrollments in /learn after assignment.",
      href: "/org/training",
    },
    {
      title: "Create a campaign",
      body: "Name the campaign, pick content, choose group_ids and/or targets, and launch. Launch queues one reminder job per recipient—there is no weekly reminder cadence. Confirm SMTP and the sending profile first.",
      href: "/org/training/campaigns",
    },
    {
      title: "Monitor and export",
      body: "Track enrollment, lesson status, watch time, and timestamps. Download CSV or PDF from the viewing report, then cancel (stops pending reminder jobs) or archive campaigns when the wave ends.",
    },
  ],
  sections: [
    {
      title: "Course library",
      body: "Everything learners open later is authored here. Keep titles clear and quizzes aligned to the lessons they follow.",
      steps: [
        {
          title: "Create a course",
          body: "Set title, description, and expected duration. Courses are the unit you assign and campaign against.",
          href: "/org/courses",
        },
        {
          title: "Add lessons",
          body: "Use article/text lessons, video (YouTube/Vimeo URL or uploaded file), or PDF upload. Order lessons in the sequence learners should finish.",
        },
        {
          title: "Configure quizzes",
          body: "Add one or more quizzes per course. Set pass score, mark required vs optional, optionally add a countdown time limit, mix multiple-choice items, and include unscored essay questions when you need free-text answers.",
        },
        {
          title: "Upload and stream media",
          body: "Confirm video uploads stream and PDFs open before assigning a large audience so the first reminder does not hit broken content.",
        },
      ],
    },
    {
      title: "Assign and track",
      body: "Assignment creates enrollments. Tracking is per learner and per lesson—not just campaign funnel totals.",
      steps: [
        {
          title: "Assign one or more courses",
          body: "From Training, pick courses and target employees and/or groups. You can assign a full course library item; campaigns remain the path for timed waves with reminders.",
          href: "/org/training",
        },
        {
          title: "Open the viewing report",
          body: "Inspect per-learner lesson status, watch time, opened-at, and completed-at timestamps so you can chase overdue people by name.",
        },
        {
          title: "Export CSV or PDF",
          body: "Download the viewing report as CSV for spreadsheets or PDF for stakeholder packs. Pair with Reporting for org-wide schedules.",
        },
        {
          title: "Send learners to /learn",
          body: "Operators stay in /org/training. Learners open the learner portal to read, watch, mark complete, and take quizzes. See the Learner portal guide.",
          href: "/learn",
        },
      ],
    },
    {
      title: "Campaigns and reminders",
      body: "Campaigns wrap content + audience + a one-shot reminder on launch. Statuses include draft, scheduled, running, completed, cancelled, and archived.",
      steps: [
        {
          title: "Launch from Training → Campaigns",
          body: "Name the wave, attach course content, select groups/employees, and launch. Each recipient gets one reminder job—no recurring weekly cadence.",
          href: "/org/training/campaigns",
        },
        {
          title: "Confirm delivery path",
          body: "Reminder mail uses org SMTP and the active sending profile. Verify Integrations and Sending profiles before the first send.",
          href: "/org/settings/integrations",
        },
        {
          title: "Read the campaign funnel",
          body: "Watch enrollments, in progress, completed, opened %, and completed % on the campaign card as learners finish lessons.",
        },
        {
          title: "Cancel or archive",
          body: "Cancel a draft, scheduled, or running wave so pending reminder jobs no-op; archive (PATCH or DELETE for running/completed) to keep the list clean without deleting history.",
        },
        {
          title: "Know the sample campaigns page",
          body: "/org/campaigns is a secondary “launch sample campaign” list (org.campaigns.manage). It is not in the sidebar; prefer Training → Campaigns for production waves.",
          href: "/org/campaigns",
        },
      ],
    },
  ],
  diagram: {
    title: "Campaign lifecycle",
    nodes: [
      { id: "library", label: "Courses" },
      { id: "audience", label: "Targets / groups" },
      { id: "campaign", label: "Campaign" },
      { id: "mail", label: "Reminders" },
      { id: "learn", label: "Learner portal" },
      { id: "metrics", label: "Progress + export" },
    ],
    edges: [
      { from: "library", to: "campaign" },
      { from: "audience", to: "campaign" },
      { from: "campaign", to: "mail" },
      { from: "campaign", to: "learn" },
      { from: "learn", to: "metrics" },
      { from: "mail", to: "metrics" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Training campaigns",
    stats: [
      { label: "Completion", value: "86%" },
      { label: "Assigned", value: "186" },
      { label: "Reminders", value: "One-shot" },
    ],
    highlight: {
      title: "Security Awareness Q4",
      caption: "Finance group · Phishing Essentials · 38 overdue",
      progress: 86,
    },
    rows: [
      { title: "Lesson 1 · Spot the lure", meta: "92% complete · 4m avg watch" },
      { title: "Quiz · Reporting phishing", meta: "81% pass · required · 15m" },
      { title: "Export viewing report", meta: "CSV + PDF ready" },
    ],
    annotations: [
      { label: "Campaign card", note: "Funnel metrics update as learners finish lessons." },
      { label: "Reminders", note: "One job per recipient on launch; cancel stops pending sends." },
    ],
  },
  related: ["learner-portal", "targets-groups", "settings", "reporting"],
};
