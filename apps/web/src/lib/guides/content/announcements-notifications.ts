import type { GuideModule } from "@/lib/guides/types";

export const announcementsNotificationsGuide: GuideModule = {
  slug: "announcements-notifications",
  title: "Announcements & notifications",
  summary:
    "Publish org-wide announcements and understand how the in-app bell surfaces training, checklist, and ticket events.",
  keywords: [
    "announcements",
    "notifications",
    "bell",
    "publish",
    "alerts",
  ],
  openInAppHref: "/org/announcements",
  overview:
    "Announcements let operators broadcast title/body messages to the organization. The notification bell (in the org shell) aggregates training assigned, checklist assigned, ticket assigned, and announcement events with deep links—updated live over Reverb with no manual refresh.",
  example: {
    title: "Mandatory training notice",
    narrative:
      "After launching Security Awareness Q4, Mira publishes “Complete phishing training by Friday”, and Finance operators see both the announcement and individual training-assigned notifications in the bell with links into /learn or campaign progress.",
  },
  steps: [
    {
      title: "Open Announcements",
      body: "Create a clear title and body for the org-wide message.",
      href: "/org/announcements",
    },
    {
      title: "Publish",
      body: "Publishing fans out in-app notifications to eligible operators.",
    },
    {
      title: "Watch the bell",
      body: "The shell notification bell lists recent events; click through to the linked resource.",
    },
    {
      title: "Correlate with module events",
      body: "Training, checklist, and ticket assignments also appear in the same bell without a separate announcements post.",
    },
  ],
  diagram: {
    title: "Notification fan-out",
    nodes: [
      { id: "event", label: "Module event" },
      { id: "announce", label: "Announcement" },
      { id: "bell", label: "Notification bell" },
      { id: "deep", label: "Deep link" },
    ],
    edges: [
      { from: "event", to: "bell" },
      { from: "announce", to: "bell" },
      { from: "bell", to: "deep" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Notifications",
    stats: [
      { label: "Unread", value: "4" },
      { label: "Announcements", value: "1 new" },
      { label: "Training", value: "2 assigned" },
    ],
    highlight: {
      title: "Complete phishing training by Friday",
      caption: "Published 10:02 · visible org-wide",
      progress: 100,
    },
    rows: [
      { title: "Training assigned · Phishing Essentials", meta: "Deep link · /learn" },
      { title: "Ticket assigned · INC-1842", meta: "Deep link · ticketing" },
      { title: "Checklist assigned · IT access", meta: "Deep link · instances" },
    ],
    annotations: [
      { label: "Bell", note: "Lives in the org shell header for signed-in users." },
      { label: "Realtime", note: "Polling covers gaps when the WebSocket is offline." },
    ],
  },
  related: ["training", "ticketing", "checklists"],
};
