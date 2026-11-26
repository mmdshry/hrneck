import type { GuideModule } from "@/lib/guides/types";

export const checklistsGuide: GuideModule = {
  slug: "checklists",
  title: "HR-Checklisten",
  summary:
    "Gestalten Sie admin-only Vorlagen mit bedingten Items, versionieren Sie sie sicher, bündeln Sie Packs mit Auto-Zuweisung und prüfen Sie jede Antwortänderung.",
  keywords: [
    "checklist",
    "onboarding",
    "offboarding",
    "vorlage",
    "instanz",
    "pack",
    "welcome pack",
    "auto-zuweisung",
    "audit",
    "hr",
    "visible_when",
    "requires",
    "version",
  ],
  openInAppHref: "/org/checklists",
  overview:
    "Checklisten sind interne HR-Workflows—kein Lerninhalt und nie auf /portal sichtbar. Admins gestalten flexible Vorlagen, kopieren die fünf System-HR-Vorlagen, bündeln Packs (zum Beispiel ein Welcome Pack), verbinden Instanzen mit Mitarbeitenden und füllen sie als Operatoren aus. Beim Speichern wählen Sie, ob ein neues Vorlagenschema auf offene Instanzen oder nur auf neue angewendet wird. Veröffentlichte Packs können bei Erstellung eines neuen Mitarbeitenden auto-zuweisen. Jede Antwortänderung landet im Tenant-Aktivitätsprotokoll.",
  example: {
    title: "Welcome Pack für Neueinstellungen",
    narrative:
      "HR kopiert Onboarding- und IT-Access-Systemvorlagen, fügt ein Select „Laptop benötigt?“ hinzu, das über visible_when eine Laptop-Checkbox einblendet, und eine Manager-Freigabe, die MFA enrolled erfordert. Sie veröffentlichen ein Welcome Pack mit Auto-Zuweisung. Wenn alex.ng@acme.test hinzugefügt wird, erscheinen beide Instanzen im Mitarbeiterprofil; Operatoren füllen Items aus und der Audit-Trail zeigt, wer die MFA-Einschreibung geprüft hat.",
  },
  steps: [
    {
      title: "Checklisten öffnen",
      body: "Durchsuchen Sie benutzerdefinierte und Systemvorlagen vom Checklisten-Hub. Kopieren Sie eine Systemvorlage, bevor Sie sie zuweisen.",
      href: "/org/checklists",
    },
    {
      title: "Vorlage bearbeiten",
      body: "Nutzen Sie den Builder für Item-Typen, visible_when-Regeln und requires-Abhängigkeiten. Speichern Sie mit der Wahl auf-offene-anwenden oder nur-neue.",
    },
    {
      title: "Pack erstellen",
      body: "Bündeln Sie Vorlagen in ein Welcome Pack und aktivieren Sie optional Auto-Zuweisung bei Mitarbeiteranlage.",
      href: "/org/checklists/packs",
    },
    {
      title: "Verbinden und ausfüllen",
      body: "Weisen Sie von Instanzen oder einem Mitarbeiterprofil zu, schließen Sie Items als HR ab und prüfen Sie die Aktivitätsprotokoll-Historie.",
      href: "/org/checklists/instances",
    },
  ],
  sections: [
    {
      title: "Vorlagen-Builder",
      body: "Vorlagen sind versionierte Formulardefinitionen. Mitarbeitende füllen diese nie aus—nur Operatoren mit org.checklists.manage.",
      steps: [
        {
          title: "Wenn möglich von einer Systemvorlage starten",
          body: "Fünf Seed-Vorlagen decken Employee Onboarding, Employee Offboarding, IT Access Provisioning, Internal Transfer / Role Change und Leave Return ab. Kopieren Sie vor dem Bearbeiten, damit das Systemoriginal erhalten bleibt.",
          href: "/org/checklists",
        },
        {
          title: "Item-Typen hinzufügen",
          body: "Unterstützte Typen: Abschnitt, Checkbox, Kurztext, Langtext, Einzelauswahl, Mehrfachauswahl, Datum, Zahl, Datei, Link und Rich Note.",
        },
        {
          title: "visible_when für Bedingungen nutzen",
          body: "Blenden Sie Items basierend auf früheren Antworten aus oder ein (zum Beispiel „Laptop-Asset-Tag“ nur zeigen, wenn Laptop benötigt = ja).",
        },
        {
          title: "requires für Abhängigkeiten nutzen",
          body: "Sperren Sie ein Item, bis ein anderes abgeschlossen ist (zum Beispiel Manager-Freigabe erfordert MFA enrolled).",
        },
        {
          title: "Builder öffnen",
          body: "Bearbeiten Sie das Schema unter /org/checklists/[id]. Halten Sie Abschnitte kurz, damit Operatoren offene Instanzen schnell scannen können.",
        },
      ],
    },
    {
      title: "Versionierung beim Speichern",
      body: "Speichern erstellt eine neue Vorlagenversion. Sie entscheiden, wie offene Arbeit betroffen ist.",
      steps: [
        {
          title: "Auf offene Instanzen anwenden wählen",
          body: "Schieben Sie das neue Schema auf noch offene Instanzen, wenn die Prozessänderung sofort gelten muss.",
        },
        {
          title: "Oder nur-neue wählen",
          body: "Lassen Sie offene Instanzen auf dem vorherigen Schema und wenden Sie die neue Version nur auf künftige Zuweisungen an—sicherer mitten in einer Welle.",
        },
      ],
    },
    {
      title: "Packs und Auto-Zuweisung",
      body: "Packs bündeln mehrere Vorlagen für eine Einstellung oder ein Lifecycle-Ereignis.",
      steps: [
        {
          title: "Pack erstellen und veröffentlichen",
          body: "Fügen Sie Vorlagen hinzu, benennen Sie das Pack (Welcome Pack ist das übliche Muster) und veröffentlichen Sie, wenn bereit.",
          href: "/org/checklists/packs",
        },
        {
          title: "Auto-Zuweisung bei Einstellung aktivieren",
          body: "Wenn aktiviert, hängt das Anlegen eines neuen Mitarbeitenden Pack-Instanzen automatisch an. Bestätigen Sie dies im Mitarbeiterprofil nach CSV-Import oder manuellem Hinzufügen.",
        },
        {
          title: "Welcome-Pack-Seed",
          body: "Demo-Tenants können bereits ein Welcome Pack enthalten, das Onboarding plus IT-Zugang bündelt—klonieren statt neu bauen.",
        },
      ],
    },
    {
      title: "Instanzen und Audit",
      body: "Eine Instanz ist eine Vorlagenversion, gebunden an einen Mitarbeitenden.",
      steps: [
        {
          title: "Von Instanzen oder dem Mitarbeiterprofil zuweisen",
          body: "Verbinden Sie eine Vorlage oder ein Pack von /org/checklists/instances oder /org/targets/[id]. Fortschritt erscheint auf beiden Oberflächen.",
          href: "/org/checklists/instances",
        },
        {
          title: "Als HR ausfüllen",
          body: "Schließen Sie Checkboxen, Texte, Selects, Daten, Zahlen, Dateien und Links ab. Dateiantworten werden auf der Instanz-Detailseite hochgeladen.",
        },
        {
          title: "Audit-Trail prüfen",
          body: "Jede Antwortänderung wird im Tenant-Aktivitätsprotokoll erfasst. Nutzen Sie die Instanz-Audit-UI, wenn Sie wer-hat-was-geändert für Compliance brauchen.",
        },
      ],
    },
  ],
  diagram: {
    title: "Vorlage-, Pack- und Mitarbeiterfluss",
    nodes: [
      { id: "template", label: "Vorlagenversion" },
      { id: "pack", label: "Checklist-Pack" },
      { id: "target", label: "Mitarbeitender" },
      { id: "instance", label: "Instanz" },
      { id: "audit", label: "Audit-Trail" },
    ],
    edges: [
      { from: "template", to: "pack" },
      { from: "template", to: "instance" },
      { from: "pack", to: "instance" },
      { from: "target", to: "instance" },
      { from: "instance", to: "audit" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Checklist-Instanzen",
    stats: [
      { label: "Offen", value: "11" },
      { label: "Packs", value: "1 welcome" },
      { label: "Vorlagen", value: "5 System" },
    ],
    highlight: {
      title: "Welcome Pack · alex.ng@acme.test",
      caption: "Onboarding + IT-Zugang verbunden",
      progress: 78,
    },
    rows: [
      { title: "MFA enrolled", meta: "Checkbox · Erledigt" },
      { title: "Laptop erforderlich?", meta: "Sichtbar wenn Laptop benötigt = ja" },
      { title: "Manager-Freigabe", meta: "Ausstehend · erfordert MFA" },
    ],
    annotations: [
      { label: "Packs", note: "Welcome Pack kann bei Einstellung auto-zuweisen." },
      { label: "Audit", note: "Jede Antwortänderung wird in der Tenant-DB protokolliert." },
    ],
  },
  related: ["targets-groups", "users-roles", "reporting"],
};
