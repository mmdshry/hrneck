import type { GuideModule } from "@/lib/guides/types";

export const targetsGroupsGuide: GuideModule = {
  slug: "targets-groups",
  title: "Mitarbeitende, Abteilungen & Gruppen",
  summary:
    "Bauen Sie die Mitarbeiterzielgruppe mit CRUD, einem CSV-Mapping-Assistenten, Abteilungen, Gruppen und Risikoscores auf.",
  keywords: [
    "mitarbeitende",
    "targets",
    "abteilungen",
    "gruppen",
    "csv",
    "zielgruppe",
    "risiko",
  ],
  openInAppHref: "/org/targets",
  overview:
    "Mitarbeitende (Targets) sind die Zielgruppe für Schulung und Checklisten und sind mit Login-Benutzern gepaart (typischerweise die Rolle learner)—sie sind keine Org-Operatoren. Verwalten Sie Mitarbeitende unter Mitarbeitende (CRUD und CSV-Assistent), öffnen Sie ein Mitarbeiterprofil für verbundene Checklisten, halten Sie Abteilungen als verwaltete Liste für Formulare und organisieren Sie sie in Gruppen mit Mitgliederauswahl, damit Kampagnen ganze Abteilungen ansprechen können. Archivieren Sie eine Gruppe soft über status=inactive. Veröffentlichte Checklist-Packs mit Auto-Zuweisung erstellen Instanzen, wenn ein neuer Mitarbeitender hinzugefügt wird.",
  example: {
    title: "Finance-CSV-Import vor Q4",
    narrative:
      "Priya öffnet Mitarbeitende importieren, lädt finance-q4.csv (186 Zeilen) hoch, mappt Email Address → email und speichert eine HR-Vorlage, prüft Create/Update-Zähler in der Vorschau, bestätigt den Import und prüft, dass Welcome-Pack-Checklisten auf einem neuen Mitarbeiterprofil auto-zugewiesen wurden.",
  },
  steps: [
    {
      title: "Mitarbeitende öffnen",
      body: "Importieren Sie Mitarbeitende und prüfen Sie Risikoscores im Arbeitsbereich Mitarbeitende.",
      href: "/org/targets",
    },
    {
      title: "Abteilungen verwalten",
      body: "Erstellen und pflegen Sie Abteilungen auf der Seite Abteilungen und wählen Sie sie beim Hinzufügen oder Importieren von Mitarbeitenden.",
      href: "/org/departments",
    },
    {
      title: "Mitarbeitende anlegen oder importieren",
      body: "Fügen Sie eine Person über das Mitarbeiterformular hinzu oder bearbeiten Sie sie (Titel, Manager, Eintrittsdatum, Telefon, Standort, Beschäftigungsart, Sprache, Zeitzone, Risiko). Nutzen Sie Mitarbeitende importieren für einen Assistenten: laden Sie eine beliebige Unternehmens-CSV hoch, mappen Sie Spalten auf Plattformfelder (E-Mail erforderlich), speichern Sie optional eine tenantbezogene Mapping-Vorlage, prüfen Sie Zeilenfehler in der Vorschau und bestätigen Sie. Auto-Zuweisungs-Packs hängen Onboarding-Checklisten an und füllen Rolle/Start/Manager aus dem Profil vor.",
    },
    {
      title: "Mitarbeiterprofil öffnen",
      body: "Nutzen Sie Öffnen in einer Zeile, um verbundene Checklisten zu prüfen und eine Vorlage oder ein Pack vom Profil aus zu verbinden.",
    },
    {
      title: "Gruppen öffnen",
      body: "Erstellen Sie Zielgruppen getrennt von der Mitarbeiterliste.",
      href: "/org/groups",
    },
    {
      title: "Mitglieder im Gruppen-Modal wählen",
      body: "Benennen Sie die Gruppe und wählen Sie Mitarbeitende mit der Mitgliederauswahl, damit Kampagnen ganze Abteilungen ansprechen können.",
    },
  ],
  diagram: {
    title: "Zielgruppen-Vorbereitungsfluss",
    nodes: [
      { id: "csv", label: "CSV / CRUD" },
      { id: "depts", label: "Abteilungen" },
      { id: "groups", label: "Gruppen" },
      { id: "risk", label: "Risikoscores" },
      { id: "ready", label: "Kampagnenbereit" },
    ],
    edges: [
      { from: "csv", to: "depts" },
      { from: "depts", to: "groups" },
      { from: "groups", to: "risk" },
      { from: "risk", to: "ready" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Mitarbeitende",
    stats: [
      { label: "Mitarbeitende", value: "186" },
      { label: "Abteilungen", value: "6" },
      { label: "Gruppen", value: "8" },
      { label: "Hohes Risiko", value: "2" },
    ],
    highlight: {
      title: "Finance-Abteilung",
      caption: "CSV-Import erfolgreich · 186 Mitarbeitende bereit",
      progress: 100,
    },
    rows: [
      { title: "alex.ng@acme.test", meta: "Finance · Risiko Hoch" },
      { title: "maya.cole@acme.test", meta: "Finance · Risiko Mittel" },
      { title: "ops-all", meta: "Gruppe · 64 Mitglieder" },
    ],
    annotations: [
      { label: "CSV", note: "Der Assistent mappt Spalten, prüft Zeilenfehler im Dry-Run, upsertet danach per E-Mail und legt bei Bedarf Abteilungen nach Namen an." },
      { label: "Gruppen", note: "Nutzen Sie die Mitgliederauswahl, damit Kampagnen ganze Abteilungen ansprechen können." },
    ],
  },
  related: ["training", "checklists", "getting-started"],
};
