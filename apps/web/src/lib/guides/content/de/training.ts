import type { GuideModule } from "@/lib/guides/types";

export const trainingGuide: GuideModule = {
  slug: "training",
  title: "Security-Awareness-Schulung",
  summary:
    "Erstellen Sie Kurse und Quizzes, weisen Sie Inhalte zu, führen Sie Erinnerungskampagnen durch und exportieren Sie den Fortschritt auf Lektionsebene für Stakeholder.",
  keywords: [
    "schulung",
    "lms",
    "kampagne",
    "kurs",
    "quiz",
    "zuweisen",
    "erinnerung",
    "watch time",
    "essay",
    "pdf-export",
    "abbrechen",
    "archivieren",
  ],
  openInAppHref: "/org/training",
  overview:
    "Kurse enthält die Bibliothek (Artikel-, Video- und PDF-Lektionen plus Quizzes). Schulung weist einen oder mehrere Kurse Mitarbeitenden und/oder Gruppen zu, führt Kampagnen aus, die mehrere Kurse enthalten können (Kurse per Drag & Drop hinzufügen und ihre Reihenfolge festlegen) und beim Start pro Empfänger eine E-Mail-Erinnerung mit allen Kursen einreihen (über SMTP und Sendeprofile), und prüft den Fortschritt pro Lektion mit CSV- oder PDF-Export. Lernende konsumieren zugewiesene Inhalte auf dem Mitarbeiter-Dashboard unter /portal—nicht in der Org-Warteschlange. Eine sekundäre Beispiel-Liste unter /org/campaigns existiert für schnelle Demos; der Operator-Workflow liegt unter Schulung → Kampagnen.",
  example: {
    title: "Acme Finance Q4-Awareness-Kampagne",
    narrative:
      "Ops baut Phishing Essentials mit drei Lektionen und einem Pflicht-Quiz (80 % Bestehen, 15-Minuten-Limit, ein Essay). Unter Schulung weisen sie den Kurs der Finance-Gruppe zu (186 Personen), starten Security Awareness Q4 (eine Erinnerungs-E-Mail pro Empfänger eingereiht), sehen den Abschluss von 12 % auf 86 % steigen und exportieren den Viewing-Report-PDF für die Führung.",
  },
  steps: [
    {
      title: "Kursbibliothek aufbauen",
      body: "Erstellen Sie Kurse und Lektionen unter Kurse, bevor Sie etwas zuweisen. Fügen Sie Quizzes mit Bestehenspunktzahl, Pflicht-Flag, Zeitlimit, Multiple Choice und optionalen Essay-Fragen hinzu.",
      href: "/org/courses",
    },
    {
      title: "Inhalt zuweisen",
      body: "Wählen Sie unter Schulung einen oder mehrere Kurse und weisen Sie sie Mitarbeitenden und/oder Gruppen zu. Lernende sehen Einschreibungen auf /portal nach der Zuweisung.",
      href: "/org/training",
    },
    {
      title: "Kampagne erstellen",
      body: "Benennen Sie die Kampagne, wählen Sie einen oder mehrere Kurse, wählen Sie group_ids und/oder Targets und starten Sie. Der Start reiht pro Empfänger eine E-Mail-Erinnerung mit allen Kursen der Kampagne ein—es gibt keinen wöchentlichen Erinnerungsrhythmus. Bestätigen Sie zuerst SMTP und das Sendeprofil.",
      href: "/org/training/campaigns",
    },
    {
      title: "Überwachen und exportieren",
      body: "Verfolgen Sie Einschreibung, Lektionsstatus, Watch Time und Zeitstempel. Laden Sie CSV oder PDF aus dem Viewing Report herunter und brechen Sie dann ab (stoppt ausstehende Erinnerungsjobs) oder archivieren Sie Kampagnen, wenn die Welle endet.",
    },
  ],
  sections: [
    {
      title: "Kursbibliothek",
      body: "Alles, was Lernende später öffnen, wird hier erstellt. Halten Sie Titel klar und Quizzes an die folgenden Lektionen ausgerichtet.",
      steps: [
        {
          title: "Kurs erstellen",
          body: "Setzen Sie Titel, Beschreibung und erwartete Dauer. Kurse sind die Einheit, die Sie zuweisen und gegen die Sie Kampagnen fahren.",
          href: "/org/courses",
        },
        {
          title: "Lektionen hinzufügen",
          body: "Nutzen Sie Artikel-/Textlektionen, Video (YouTube-/Vimeo-URL oder hochgeladene Datei), Audio oder Dokument-Upload (PDF, TXT, MD, DOC, DOCX) bis 100 MB. Ordnen Sie Lektionen in der Sequenz, die Lernende abschließen sollen.",
        },
        {
          title: "Quizzes konfigurieren",
          body: "Fügen Sie ein oder mehrere Quizzes pro Kurs hinzu. Setzen Sie Bestehenspunktzahl, markieren Sie Pflicht vs. optional, fügen Sie optional ein Countdown-Zeitlimit hinzu, mischen Sie Multiple-Choice-Items und nehmen Sie unbewertete Essay-Fragen auf, wenn Sie Freitextantworten brauchen.",
        },
        {
          title: "Medien hochladen und streamen",
          body: "Nutzen Sie Vorschau unter Kurse, um zu bestätigen, dass Video-/Audio-Streams und Dokumente öffnen, bevor Sie eine große Zielgruppe zuweisen—damit die erste Erinnerung nicht auf kaputte Inhalte trifft.",
        },
      ],
    },
    {
      title: "Zuweisen und verfolgen",
      body: "Die Zuweisung erstellt Einschreibungen. Tracking ist pro Lernendem und pro Lektion—nicht nur Kampagnen-Trichter-Summen.",
      steps: [
        {
          title: "Einen oder mehrere Kurse zuweisen",
          body: "Wählen Sie unter Schulung Kurse und zielen Sie auf Mitarbeitende und/oder Gruppen. Sie können ein vollständiges Kursbibliotheks-Item zuweisen; Kampagnen bleiben der Weg für zeitgesteuerte Wellen mit Erinnerungen.",
          href: "/org/training",
        },
        {
          title: "Viewing Report öffnen",
          body: "Prüfen Sie Lektionsstatus, Watch Time, geöffnet-um und abgeschlossen-um pro Lernendem, damit Sie überfällige Personen namentlich nachverfolgen können.",
        },
        {
          title: "CSV oder PDF exportieren",
          body: "Laden Sie den Viewing Report als CSV für Tabellenkalkulationen oder PDF für Stakeholder-Packs herunter. Kombinieren Sie mit Berichten für org-weite Zeitpläne.",
        },
        {
          title: "Lernende zu /portal senden",
          body: "Operatoren bleiben in /org/training. Lernende öffnen das Lernerportal zum Lesen, Ansehen, Abschließen und Quizzen. Siehe Guide Lernerportal.",
          href: "/portal",
        },
      ],
    },
    {
      title: "Kampagnen und Erinnerungen",
      body: "Kampagnen bündeln einen oder mehrere Kurse + Zielgruppe + eine einmalige Erinnerung beim Start. Status umfassen draft, scheduled, running, completed, cancelled und archived.",
      steps: [
        {
          title: "Von Schulung → Kampagnen starten",
          body: "Benennen Sie die Welle, fügen Sie einen oder mehrere Kurse hinzu, wählen Sie Gruppen/Mitarbeitende und starten Sie. Jeder Empfänger erhält eine E-Mail-Erinnerung mit allen Kursen der Welle—keinen wiederkehrenden Wochenrhythmus.",
          href: "/org/training/campaigns",
        },
        {
          title: "Kurse in der Kampagne anordnen",
          body: "Ziehen Sie einen Kurs aus der Kursbibliothek auf eine Kampagne oder klicken Sie auf „Hinzufügen“. Ziehen Sie Zeilen oder nutzen Sie die Schaltflächen nach oben und unten, um die Reihenfolge festzulegen, die Lernende sehen. Kurse lassen sich nur ändern, solange die Kampagne ein Entwurf oder geplant ist; eine Kampagne gilt als abgeschlossen, wenn alle ihre Kurse beendet sind.",
          href: "/org/training/campaigns",
        },
        {
          title: "Zustellungspfad bestätigen",
          body: "Erinnerungsmail nutzt Org-SMTP und das aktive Sendeprofil. Prüfen Sie Integrationen und Sendeprofile vor dem ersten Versand.",
          href: "/org/settings/integrations",
        },
        {
          title: "Kampagnen-Trichter lesen",
          body: "Beobachten Sie Einschreibungen, in Bearbeitung, abgeschlossen, geöffnet % und abgeschlossen % auf der Kampagnenkarte, während Lernende Lektionen beenden.",
        },
        {
          title: "Abbrechen oder archivieren",
          body: "Brechen Sie eine draft-, scheduled- oder running-Welle ab, damit ausstehende Erinnerungsjobs no-op; archivieren (PATCH oder DELETE für running/completed), um die Liste sauber zu halten, ohne Historie zu löschen.",
        },
        {
          title: "Beispiel-Kampagnenseite kennen",
          body: "/org/campaigns ist eine sekundäre „Beispielkampagne starten“-Liste (org.campaigns.manage). Sie ist nicht in der Seitenleiste; bevorzugen Sie Schulung → Kampagnen für Produktionswellen.",
          href: "/org/campaigns",
        },
      ],
    },
  ],
  diagram: {
    title: "Kampagnen-Lebenszyklus",
    nodes: [
      { id: "library", label: "Kurse" },
      { id: "audience", label: "Targets / Gruppen" },
      { id: "campaign", label: "Kampagne" },
      { id: "mail", label: "Erinnerungen" },
      { id: "learn", label: "Lernerportal" },
      { id: "metrics", label: "Fortschritt + Export" },
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
    chromeTitle: "Acme · Schulungskampagnen",
    stats: [
      { label: "Abschluss", value: "86%" },
      { label: "Zugewiesen", value: "186" },
      { label: "Erinnerungen", value: "Einmalig" },
    ],
    highlight: {
      title: "Security Awareness Q4",
      caption: "Finance-Gruppe · Phishing Essentials · 38 überfällig",
      progress: 86,
    },
    rows: [
      { title: "Lektion 1 · Köder erkennen", meta: "92 % abgeschlossen · 4 Min. avg Watch" },
      { title: "Quiz · Phishing melden", meta: "81 % bestanden · Pflicht · 15 Min." },
      { title: "Viewing Report exportieren", meta: "CSV + PDF bereit" },
    ],
    annotations: [
      { label: "Kampagnenkarte", note: "Trichtermetriken aktualisieren sich, wenn Lernende Lektionen beenden." },
      { label: "Erinnerungen", note: "Ein Job pro Empfänger beim Start; Abbrechen stoppt ausstehende Sends." },
    ],
  },
  related: ["learner-portal", "targets-groups", "settings", "reporting"],
};
