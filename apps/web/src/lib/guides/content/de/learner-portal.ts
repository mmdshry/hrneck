import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Lernerportal",
  summary:
    "Schließen Sie zugewiesene Kurse ab, sehen Sie Lektionen mit aufgezeichneter Watch Time, machen Sie Quizzes und folgen Sie Schulungsbenachrichtigungen auf Ihrem Mitarbeiter-Dashboard unter /portal.",
  keywords: [
    "lerner",
    "learn",
    "dashboard",
    "quiz",
    "kurs",
    "einschreibung",
    "watch time",
    "essay",
    "portal",
  ],
  openInAppHref: "/portal",
  overview:
    "Mitarbeitende landen nach der Anmeldung auf ihrem Dashboard unter /portal. Unter Meine Kurse stehen die Security-Awareness-Schulungen, die ihnen zugewiesen wurden: Operatoren weisen Kurse unter /org/training zu, und Lernende öffnen jeden Kurs, um Lektionen zu sehen, Artikel zu lesen, hochgeladenes oder eingebettetes Video anzusehen (Watch Time wird gemeldet), PDFs zu öffnen, Lektionen als abgeschlossen zu markieren und Quizzes mit Bestehenspunktzahlen, optionalen Flags, Countdowns und Essay-Antworten zu machen. Dasselbe Dashboard verlinkt auf Meine Tickets und die Wissensdatenbank. HR-Checklisten erscheinen hier nie. Die Benachrichtigungsglocke zeigt training_assigned-Ereignisse mit Deep Links zurück nach /portal. Der Plan kann Meine Kurse ausblenden; der Rest des Dashboards funktioniert weiter.",
  example: {
    title: "Finance-Analyst schließt Phishing Essentials ab",
    narrative:
      "Maya öffnet /portal, sieht Security Awareness Q4 unter Meine Kurse bei 40 %, sieht Lektion 2 (4 Minuten aufgezeichnet), markiert sie als abgeschlossen und macht dann das Pflicht-Quiz mit 15-Minuten-Countdown. Sie besteht mit 88 %, hinterlässt einen Essay zu „wie sie einen Köder melden würde“, und der Org-Viewing-Report aktualisiert ihre Zeile, bevor die nächste Erinnerung feuert.",
  },
  steps: [
    {
      title: "Am Tenant-Host anmelden",
      body: "Nutzen Sie Ihr Org-Konto auf {slug}.hrneck.test. MFA kann erforderlich sein. Lernende nutzen weder MSP noch Filament-Admin.",
      href: "/login",
    },
    {
      title: "Mitarbeiter-Dashboard unter /portal öffnen",
      body: "Unter Meine Kurse sehen Sie zugewiesene Schulungen mit Status und Fortschritt. Nur Einschreibungen aus Schulungszuweisungen oder Kampagnen erscheinen. Meine Tickets und die Wissensdatenbank sind einen Klick entfernt.",
      href: "/portal",
    },
    {
      title: "Lektionen abschließen",
      body: "Lesen Sie Artikel, sehen Sie Video (URL oder Upload), öffnen Sie PDFs und markieren Sie jede Lektion als abgeschlossen, wenn fertig.",
    },
    {
      title: "Quizzes machen",
      body: "Respektieren Sie Bestehenspunktzahl, Pflicht vs. optional und jeden Countdown. Beantworten Sie Multiple Choice und unbewertete Essays und senden Sie ab.",
    },
    {
      title: "Benachrichtigungsglocke beobachten",
      body: "Neue Schulungszuweisungen erscheinen in der Glocke mit einem Deep Link in den Kurs auf Ihrem Dashboard.",
    },
  ],
  sections: [
    {
      title: "Was Lernende nie sehen",
      steps: [
        {
          title: "Keine HR-Checklisten",
          body: "Onboarding-/Offboarding-Formulare sind admin-only unter /org/checklists. Mitarbeitende sind Zielgruppendatensätze; Checklist-Instanzen werden von HR-Operatoren ausgefüllt.",
        },
        {
          title: "Keine Org-Admin-Seitenleiste",
          body: "Kursautorenschaft, Kampagnenstart und Viewing-Report-Export bleiben in /org für Benutzer mit org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Lernerpfad",
    nodes: [
      { id: "assign", label: "Org weist Kurs zu" },
      { id: "learn", label: "Meine Kurse auf /portal" },
      { id: "lesson", label: "Lektion" },
      { id: "quiz", label: "Quiz" },
      { id: "report", label: "Org-Viewing-Report" },
    ],
    edges: [
      { from: "assign", to: "learn" },
      { from: "learn", to: "lesson" },
      { from: "lesson", to: "quiz" },
      { from: "quiz", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Lerner · Meine Kurse",
    stats: [
      { label: "Zugewiesen", value: "2" },
      { label: "In Bearbeitung", value: "1" },
      { label: "Abgeschlossen", value: "1" },
    ],
    highlight: {
      title: "Phishing Essentials",
      caption: "Lektion 2 von 3 · 4 Min. gesehen · Quiz als Nächstes freigeschaltet",
      progress: 66,
    },
    rows: [
      { title: "Lektion 1 · Köder erkennen", meta: "Abgeschlossen" },
      { title: "Lektion 2 · Sichere Links", meta: "In Bearbeitung · Video" },
      { title: "Quiz · Phishing melden", meta: "Pflicht · 15-Min.-Limit" },
    ],
    annotations: [
      { label: "Watch Time", note: "Video-Fortschritt meldet zurück an den Org-Viewing-Report." },
      { label: "Glocke", note: "training_assigned-Benachrichtigungen deep-linken nach /portal." },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
