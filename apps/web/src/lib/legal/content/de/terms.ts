import type { LegalDocument } from "@/lib/legal/types";

export const termsDe: LegalDocument = {
  slug: "terms",
  title: "Nutzungsbedingungen",
  summary:
    "Die Regeln für die Nutzung des HRNECK Training Portal, einschließlich der Anwendung der Business Associate Agreement auf geschützte Gesundheitsinformationen.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "acceptance",
      title: "Annahme dieser Bedingungen",
      paragraphs: [
        "Diese Nutzungsbedingungen („Bedingungen“) regeln den Zugang zum HRNECK Training Portal und zu den damit verbundenen Diensten („Dienste“), die von HRNECK („HRNECK“, „wir“) bereitgestellt werden, sowie deren Nutzung. Indem Sie ein Konto erstellen, sich anmelden oder die Dienste im Namen einer Organisation nutzen, stimmen Sie diesen Bedingungen zu. Wenn Sie sie im Namen einer Organisation annehmen, erklären Sie, dass Sie befugt sind, diese Organisation zu binden.",
        "Wenn Sie diesen Bedingungen nicht zustimmen, nutzen Sie die Dienste nicht.",
      ],
    },
    {
      id: "definitions",
      title: "Begriffsbestimmungen",
      paragraphs: ["In diesen Bedingungen gilt:"],
      bullets: [
        "Kunde: der MSP oder die Organisation, die einen Vertrag mit HRNECK über die Dienste hat.",
        "Benutzer: Personen, die im Auftrag eines Kunden auf die Dienste zugreifen, einschließlich Bediener, Administratoren, Lernende und Nutzer des Service-Desks.",
        "PHI: geschützte Gesundheitsinformationen im Sinne von 45 CFR 160.103.",
        "BAA: eine schriftliche Business Associate Agreement zwischen HRNECK und einem Kunden, die 45 CFR 164.504(e) und 164.308(b) entspricht.",
        "Tenant: der isolierte Arbeitsbereich eines Kunden innerhalb der Dienste.",
      ],
    },
    {
      id: "services",
      title: "Die Dienste",
      paragraphs: [
        "Die Dienste umfassen Security-Awareness-Schulungen und -Kampagnen, Lernmanagement, HR-Checklisten, IT-Service-Management und Ticketing, Berichte und Exporte, Portale für Lernende und den Service sowie optionale KI-Assistenzfunktionen. Welche Funktionen einem Kunden zur Verfügung stehen, hängt von seinem Abonnementplan und den aktivierten Einstellungen ab. [TBD: state the availability target and support hours, or reference the service level agreement.]",
      ],
    },
    {
      id: "baa",
      title: "Business Associate Agreement und Rangfolge",
      paragraphs: [
        "Ein Kunde, der eine Covered Entity oder ein Business Associate ist, muss vor dem Erstellen, Empfangen, Speichern oder Übertragen von PHI in den Diensten eine BAA mit HRNECK abschließen.",
        "Die BAA regelt, wie HRNECK PHI verwenden und offenlegen darf, und legt die Pflichten zu Sicherheit, Meldung von Datenpannen, Subunternehmern sowie Rückgabe oder Löschung fest. Widersprechen sich diese Bedingungen und eine BAA hinsichtlich PHI, hat die BAA Vorrang. In allen anderen Punkten gelten diese Bedingungen.",
      ],
    },
    {
      id: "phi_restrictions",
      title: "Beschränkungen für PHI",
      paragraphs: ["Kunden und Benutzer müssen Folgendes beachten:"],
      bullets: [
        "Geben Sie keine PHI in die Dienste ein, sofern keine BAA in Kraft ist, die diese Nutzung abdeckt.",
        "Platzieren Sie keine PHI in Freitextfeldern, Ticket-Titeln oder -Texten, Checklisten-Notizen, hochgeladenen Dateien, E-Mails an ein Ticket-Postfach oder Nachrichten an den Assistant, sofern die BAA dies nicht ausdrücklich zulässt.",
        "Beachten Sie den Grundsatz der Datenminimierung. Beschränken Sie PHI auf das, was der Zweck erfordert.",
        "Verwenden Sie keine echten PHI in Demonstrationen, Testmandanten oder Inhalten von Phishing-Simulationen.",
        "Wenn wir vernünftigerweise annehmen, dass PHI in einen Kanal gelangt ist, den die BAA nicht abdeckt, können wir die betroffene Funktion oder die Daten einschränken und informieren den Kunden so bald wie möglich.",
      ],
    },
    {
      id: "accounts",
      title: "Konten und Zugriff",
      paragraphs: ["Kunden und Benutzer müssen folgende Regeln einhalten:"],
      bullets: [
        "Jeder Benutzer benötigt ein individuelles Konto. Zugangsdaten dürfen nicht geteilt werden.",
        "Kunden verwalten Benutzer, Rollen und Berechtigungen und müssen den Zugang entziehen, wenn eine Person ausscheidet oder ihre Rolle wechselt.",
        "Kunden sollten MFA für alle Administrator- und Bedienerkonten aktivieren.",
        "Sie sind für Aktivitäten unter Ihrem Konto verantwortlich und müssen uns einen vermuteten unbefugten Zugriff umgehend melden.",
      ],
    },
    {
      id: "acceptable_use",
      title: "Zulässige Nutzung",
      paragraphs: ["Sie dürfen nicht:"],
      bullets: [
        "die Dienste für rechtswidrige Zwecke oder zur Verletzung von Rechten Dritter nutzen.",
        "versuchen, auf den Tenant, die Daten oder die Konten eines anderen Kunden zuzugreifen oder die Sicherheit der Dienste ohne unsere schriftliche Genehmigung zu prüfen, zu scannen oder zu testen.",
        "den Betrieb oder die Verfügbarkeit der Dienste stören, auch durch übermäßige automatisierte Anfragen.",
        "Phishing-Simulationen durchführen oder Schulungen nur an Personen senden, die Sie zu testen oder zu schulen berechtigt sind, und dabei die anwendbaren arbeits- und kommunikationsrechtlichen Vorschriften einhalten.",
        "Schadcode oder Inhalte hochladen, die geistige Eigentumsrechte Dritter verletzen.",
      ],
    },
    {
      id: "customer_responsibilities",
      title: "Pflichten des Kunden",
      paragraphs: [
        "Der Kunde ist für die Richtigkeit und Rechtmäßigkeit der von ihm bereitgestellten Informationen verantwortlich; für die Hinweise und Einwilligungen, die für Schulung und Überwachung von Beschäftigten erforderlich sind; für die Konfiguration der Dienste gemäß seinen eigenen HIPAA-Richtlinien und seiner Risikoanalyse; und für die Schulung der eigenen Benutzer.",
      ],
    },
    {
      id: "assistant",
      title: "KI-Assistenzfunktionen",
      paragraphs: [
        "Wenn eine Organisation den Assistant aktiviert, können Benutzernachrichten sowie zugehöriger Ticket- oder Schulungskontext von einem Drittanbieter-Konversationsdienst verarbeitet werden, derzeit Microsoft Copilot Studio. Antworten des Assistant können unzutreffend sein und müssen vor einer Verwendung geprüft werden. Senden Sie keine PHI über den Assistant, sofern die BAA diesen Unterauftragsverarbeiter nicht abdeckt. [TBD: confirm subprocessor status and BAA coverage for Microsoft Copilot Studio.]",
      ],
    },
    {
      id: "fees",
      title: "Gebühren, Testphasen und Abonnements",
      paragraphs: [
        "Gebühren, Abrechnungsbedingungen, Testzeiträume und Planlimits ergeben sich aus dem Bestellformular, dem Abonnementplan oder den bei der Registrierung angezeigten Preisen. Wir können die Dienste bei Zahlungsverzug nach angemessener Ankündigung aussetzen [TBD: confirm notice period].",
      ],
    },
    {
      id: "intellectual_property",
      title: "Geistiges Eigentum",
      paragraphs: [
        "HRNECK und seine Lizenzgeber besitzen die Dienste, einschließlich Software, Designs und Dokumentation. Wir gewähren Ihnen ein beschränktes, nicht ausschließliches und nicht übertragbares Recht, die Dienste während Ihres Abonnements zu nutzen. Kunden sind Eigentümer ihrer Daten. Sie gewähren uns die Rechte, die wir benötigen, um diese Daten zur Bereitstellung der Dienste zu hosten und zu verarbeiten.",
      ],
    },
    {
      id: "disclaimers",
      title: "Haftungsausschlüsse",
      paragraphs: [
        "Soweit gesetzlich zulässig, werden die Dienste „wie besehen“ und „wie verfügbar“ bereitgestellt. Security-Awareness-Schulungen und HIPAA-unterstützende Funktionen helfen, Risiken zu reduzieren, machen einen Kunden aber allein nicht konform mit HIPAA oder einem anderen Gesetz.",
      ],
    },
    {
      id: "liability",
      title: "Haftungsbeschränkung",
      paragraphs: [
        "Soweit gesetzlich zulässig, haftet HRNECK nicht für indirekte, zufällige, besondere, Folge- oder Strafschäden. Unsere Gesamthaftung ist auf die Gebühren begrenzt, die der Kunde in den zwölf Monaten vor dem auslösenden Ereignis für die Dienste gezahlt hat [TBD: confirm cap]. Legt eine BAA eigene Haftungsbedingungen für PHI fest, gelten diese für PHI. Nichts in diesen Bedingungen begrenzt eine Haftung, die gesetzlich nicht begrenzt werden kann.",
      ],
    },
    {
      id: "termination",
      title: "Kündigung",
      paragraphs: [
        "Jede Partei kann das Abonnement gemäß dem Bestellformular oder dem Plan kündigen. Wir können den Zugang sofort sperren oder beenden, wenn Sie diese Bedingungen oder die BAA wesentlich verletzen oder wenn der weitere Zugang ein Sicherheitsrisiko darstellen würde.",
        "Mit Ende des Abonnements endet Ihr Zugang, und HRNECK gibt PHI zurück oder vernichtet sie, wie in der Datenschutzerklärung und der BAA beschrieben. Die Abschnitte zu geistigem Eigentum, Haftungsausschlüssen, Haftungsbeschränkung und anwendbarem Recht gelten auch nach der Beendigung weiter.",
      ],
    },
    {
      id: "governing_law",
      title: "Anwendbares Recht und Streitigkeiten",
      paragraphs: [
        "Diese Bedingungen unterliegen dem Recht des Bundesstaates Kalifornien, USA, unter Ausschluss der Kollisionsnormen [TBD: confirm governing law]. Die staatlichen und bundesstaatlichen Gerichte im Bezirk San Diego County, Kalifornien, sind ausschließlich zuständig, sofern die BAA oder das Bestellformular nichts anderes bestimmt.",
      ],
    },
    {
      id: "changes",
      title: "Änderungen dieser Bedingungen",
      paragraphs: [
        "Wir können diese Bedingungen aktualisieren. Wir aktualisieren das Datum des Inkrafttretens und informieren Administratorkonten per E-Mail mindestens [TBD: 30] Tage vor dem Inkrafttreten wesentlicher Änderungen. Die weitere Nutzung der Dienste nach dem Inkrafttreten gilt als Annahme der aktualisierten Bedingungen.",
      ],
    },
    {
      id: "contact",
      title: "Kontakt",
      paragraphs: [
        "Fragen zu diesen Bedingungen können an support@hrneck.com gerichtet werden. Rechtliche Mitteilungen sind an HRNECK, San Diego, Kalifornien, USA, zu richten. [TBD: confirm the legal entity name and notice address.]",
      ],
    },
  ],
};
