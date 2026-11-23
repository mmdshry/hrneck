import type { GuideModule } from "@/lib/guides/types";

export const announcementsNotificationsGuide: GuideModule = {
  slug: "announcements-notifications",
  title: "Ankündigungen & Benachrichtigungen",
  summary:
    "Veröffentlichen Sie org-weite Ankündigungen und verstehen Sie, wie die In-App-Glocke Schulungs-, Checklist- und Ticket-Ereignisse anzeigt.",
  keywords: [
    "ankündigungen",
    "benachrichtigungen",
    "glocke",
    "veröffentlichen",
    "alarme",
  ],
  openInAppHref: "/org/announcements",
  overview:
    "Ankündigungen lassen Operatoren Titel-/Körper-Nachrichten an die Organisation senden. Die Benachrichtigungsglocke (in der Org-Shell) aggregiert zugewiesene Schulung, zugewiesene Checkliste, zugewiesenes Ticket und Ankündigungsereignisse mit Deep Links—live über Reverb aktualisiert ohne manuelles Aktualisieren.",
  example: {
    title: "Pflichtschulungs-Hinweis",
    narrative:
      "Nach dem Start von Security Awareness Q4 veröffentlicht Mira „Phishing-Schulung bis Freitag abschließen“, und Finance-Operatoren sehen sowohl die Ankündigung als auch einzelne Schulungs-zugewiesen-Benachrichtigungen in der Glocke mit Links zu /learn oder Kampagnenfortschritt.",
  },
  steps: [
    {
      title: "Ankündigungen öffnen",
      body: "Erstellen Sie einen klaren Titel und Körper für die org-weite Nachricht.",
      href: "/org/announcements",
    },
    {
      title: "Veröffentlichen",
      body: "Das Veröffentlichen sendet In-App-Benachrichtigungen an berechtigte Operatoren.",
    },
    {
      title: "Glocke beobachten",
      body: "Die Shell-Benachrichtigungsglocke listet aktuelle Ereignisse; klicken Sie durch zur verknüpften Ressource.",
    },
    {
      title: "Mit Modulereignissen korrelieren",
      body: "Schulungs-, Checklist- und Ticket-Zuweisungen erscheinen auch in derselben Glocke ohne separaten Ankündigungspost.",
    },
  ],
  diagram: {
    title: "Benachrichtigungs-Fan-out",
    nodes: [
      { id: "event", label: "Modulereignis" },
      { id: "announce", label: "Ankündigung" },
      { id: "bell", label: "Benachrichtigungsglocke" },
      { id: "deep", label: "Deep Link" },
    ],
    edges: [
      { from: "event", to: "bell" },
      { from: "announce", to: "bell" },
      { from: "bell", to: "deep" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Benachrichtigungen",
    stats: [
      { label: "Ungelesen", value: "4" },
      { label: "Ankündigungen", value: "1 neu" },
      { label: "Schulung", value: "2 zugewiesen" },
    ],
    highlight: {
      title: "Phishing-Schulung bis Freitag abschließen",
      caption: "Veröffentlicht 10:02 · org-weit sichtbar",
      progress: 100,
    },
    rows: [
      { title: "Schulung zugewiesen · Phishing Essentials", meta: "Deep Link · /learn" },
      { title: "Ticket zugewiesen · INC-1842", meta: "Deep Link · Ticketing" },
      { title: "Checkliste zugewiesen · IT-Zugang", meta: "Deep Link · Instanzen" },
    ],
    annotations: [
      { label: "Glocke", note: "Lebt im Org-Shell-Header für angemeldete Benutzer." },
      { label: "Echtzeit", note: "Polling deckt Lücken ab, wenn der WebSocket offline ist." },
    ],
  },
  related: ["training", "ticketing", "checklists"],
};
