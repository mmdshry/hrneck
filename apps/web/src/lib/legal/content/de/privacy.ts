import type { LegalDocument } from "@/lib/legal/types";

export const privacyDe: LegalDocument = {
  slug: "privacy",
  title: "Datenschutzerklärung",
  summary:
    "Wie HRneck geschützte Gesundheitsinformationen und andere personenbezogene Daten als Business Associate nach HIPAA verarbeitet und welche Schutzmaßnahmen wir einhalten.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "scope",
      title: "Geltungsbereich und unsere Rolle",
      paragraphs: [
        "Diese Datenschutzerklärung beschreibt, wie HRneck („HRneck“, „wir“) Informationen im HRneck Training Portal erhebt, verwendet, offenlegt und schützt. Das HRneck Training Portal ist eine Plattform für Security-Awareness-Schulungen für Managed Service Provider (MSPs) und Organisationen.",
        "Wenn ein Kunde, der eine Covered Entity oder ein Business Associate im Sinne des Health Insurance Portability and Accountability Act of 1996 und seiner Durchführungsverordnungen (HIPAA) ist, HRneck nutzt, um geschützte Gesundheitsinformationen (Protected Health Information, PHI) zu erstellen, zu empfangen, zu speichern oder zu übertragen, handelt HRneck als Business Associate dieses Kunden. Die Business Associate Agreement (BAA) zwischen HRneck und dem Kunden ist das verbindliche Dokument für PHI. Widersprechen sich diese Erklärung und eine BAA hinsichtlich PHI, hat die BAA Vorrang.",
        "Diese Erklärung beschreibt, wie wir arbeiten. Sie ersetzt weder die BAA noch die eigene Datenschutzerklärung des Kunden oder dessen Pflichten nach HIPAA.",
      ],
    },
    {
      id: "information",
      title: "Informationen, die wir verarbeiten",
      paragraphs: [
        "Je nach Nutzung von HRneck durch den Kunden verarbeiten wir in dessen Auftrag folgende Kategorien von Informationen:",
      ],
      bullets: [
        "Personal- und Zielpersonendaten: Namen, geschäftliche E-Mail-Adressen, Telefonnummern, Standorte, Mitarbeiternummern, Abteilungen und Gruppenzugehörigkeiten.",
        "Schulungsdaten: Kursanmeldungen, Fortschritt, Quizergebnisse und Schulungsnachweise.",
        "Daten von Phishing-Simulationen: Kampagnenereignisse wie Zustellung, Öffnungen, Klicks und Übermittlungen.",
        "Service-Desk-Daten: Tickets, Notizen, Anhänge und Inhalte eingehender E-Mails, die an ein konfiguriertes Ticket-Postfach gesendet werden.",
        "HR-Checklisten-Daten: Vorlagen, Instanzen, Antworten und hochgeladene Dateien.",
        "Konto- und Authentifizierungsdaten: Anmeldekennungen, Passwort-Hashes, Einstellungen zur Multi-Faktor-Authentifizierung (MFA), Passkey-Anmeldedaten und Kennungen für Single Sign-on.",
        "Aktivitäts- und Audit-Protokolle: Aktionen von Bedienern und Administratoren innerhalb eines Tenants.",
        "Technische Daten: IP-Adressen und Anfrageprotokolle, die für Betrieb, Sicherheit und Fehlerbehebung des Dienstes erforderlich sind.",
      ],
    },
    {
      id: "phi",
      title: "Geschützte Gesundheitsinformationen",
      paragraphs: [
        "Beschäftigungsunterlagen, die eine Covered Entity in ihrer Eigenschaft als Arbeitgeber führt, sind von der Definition der PHI ausgenommen (45 CFR 160.103). Schulungsdaten und HR-Checklisten, die ein Kunde als Arbeitgeber verarbeitet, sind in der Regel Beschäftigungsunterlagen. Diese Ausnahme gilt nicht für Gesundheitsinformationen über Patienten oder Klienten, die in diesen Unterlagen erfasst werden.",
        "Kunden dürfen keine PHI in HRneck eingeben, sofern eine BAA diese Nutzung nicht abdeckt. Tickets, Checklisten-Antworten, Notizen, hochgeladene Dateien und Nachrichten an den Assistant sind Freitextkanäle und dürfen keine PHI enthalten, sofern die BAA dies nicht zulässt.",
        "Wir verwenden und offenlegen PHI nur, soweit die BAA es zulässt oder das Gesetz es verlangt (45 CFR 164.502(a)).",
      ],
    },
    {
      id: "use",
      title: "Wie wir Informationen verwenden und offenlegen",
      paragraphs: [
        "Wir verwenden Informationen nur, um die HRneck-Dienste für den Kunden bereitzustellen, abzusichern, zu unterstützen und zu verbessern, wie im Kundenvertrag und in der BAA beschrieben.",
        "Wir verkaufen keine PHI und verwenden PHI nicht für Marketing oder Werbung.",
        "Wir verwenden oder offenlegen PHI nicht in einer Weise, die der Kunde nicht selbst vornehmen dürfte, sofern die BAA dies nicht ausdrücklich erlaubt. Jede Pseudonymisierung oder aggregierte Analyse erfolgt nur, wenn die BAA dies zulässt, und gemäß 45 CFR 164.514.",
        "Wir legen PHI Subunternehmern nur unter den Bedingungen des Abschnitts zu Subunternehmern unten offen und Behörden, wenn das Gesetz dies verlangt.",
      ],
    },
    {
      id: "safeguards",
      title: "Schutzmaßnahmen",
      paragraphs: [
        "Wir unterhalten administrative, physische und technische Schutzmaßnahmen, die Vertraulichkeit, Integrität und Verfügbarkeit elektronischer PHI sicherstellen, im Einklang mit der HIPAA-Sicherheitsregel (45 CFR 164.302 bis 164.318). Dazu gehören:",
      ],
      bullets: [
        "Zugriffskontrolle: eindeutige Benutzerkennungen, rollenbasierte Berechtigungen und Standardeinstellungen nach dem Least-Privilege-Prinzip für jedes Bedienerkonto (45 CFR 164.312(a)).",
        "Automatische Abmeldung: Sitzungen laufen nach einer Zeit der Inaktivität ab. Die konfigurierte Sitzungsdauer beträgt 120 Minuten [TBD: confirm the production value].",
        "Authentifizierung: Passwortanforderungen, zeitbasierte Einmalpasswörter (TOTP), Passkeys (WebAuthn) und einmalig verwendbare Wiederherstellungscodes (45 CFR 164.312(d)).",
        "Audit-Kontrollen: Aktivitätsprotokolle des Tenants, die Aktionen von Administratoren und Bedienern festhalten (45 CFR 164.312(b)). Aktivitätsprotokolle werden standardmäßig nach 180 Tagen bereinigt [TBD: confirm the retention setting for PHI-bearing tenants].",
        "Integrität: authentifizierter API-Zugriff und serverseitige Validierung, die Datensätze vor unbefugter Änderung schützen (45 CFR 164.312(c)).",
        "Übertragungssicherheit: verschlüsselte Verbindungen (TLS) für Browser- und API-Datenverkehr (45 CFR 164.312(e)) [TBD: confirm minimum TLS version].",
        "Verschlüsselung: Verschlüsselung auf Anwendungsebene (AES-256-CBC) gespeicherter Geheimnisse wie Postfach-Zugangsdaten [TBD: confirm encryption at rest for database storage and backups].",
        "Mandantentrennung: Die Daten jedes Tenants werden in einer eigenen Tenant-Datenbank gespeichert.",
        "Risikomanagement: Risikoanalyse und Behandlung identifizierter Risiken (45 CFR 164.308(a)(1)) [TBD: confirm review cadence].",
      ],
    },
    {
      id: "incidents",
      title: "Sicherheitsvorfälle und Meldung von Datenpannen",
      paragraphs: [
        "Wir erfassen Sicherheitsvorfälle, die PHI betreffen, und dokumentieren unsere Reaktion. Entdecken wir eine Verletzung ungesicherter PHI, benachrichtigen wir die betroffene Covered Entity ohne unangemessene Verzögerung und in jedem Fall spätestens [TBD: 5 business days] nach der Entdeckung, wie in 45 CFR 164.410 vorgeschrieben. Sieht die BAA eine kürzere Frist vor, gilt die BAA.",
        "Soweit bekannt, benennt die Benachrichtigung jede Person, deren PHI betroffen war, beschreibt, was geschehen ist und welche Arten von PHI betroffen sind, beschreibt die ergriffenen Maßnahmen und nennt eine Kontaktstelle für Rückfragen. Wir informieren den Kunden, sobald weitere Informationen vorliegen.",
        "Kunden, die einen Vorfall vermuten, sollten sich umgehend an die unten genannte Datenschutz- und Sicherheitskontaktstelle wenden.",
      ],
    },
    {
      id: "subcontractors",
      title: "Subunternehmer und Unterauftragsverarbeiter",
      paragraphs: [
        "Wir verlangen von Subunternehmern, die in unserem Auftrag PHI erstellen, empfangen, speichern oder übertragen, dass sie schriftlich dieselben Beschränkungen und Bedingungen akzeptieren, die für uns gelten (45 CFR 164.502(e)(1)(ii) und 164.308(b)).",
        "[TBD: publish the subprocessor list, including hosting, database and backup, email delivery (SMTP), DNS and content delivery, and Microsoft Copilot Studio if the Assistant is enabled for a tenant.] Kunden können die aktuelle Liste jederzeit anfordern.",
        "Ist der Assistant aktiviert, werden Nachrichten an einen Drittanbieter-Konversationsdienst (Microsoft Copilot Studio) gesendet. Kunden dürfen über den Assistant keine PHI senden, sofern die BAA diesen Unterauftragsverarbeiter nicht abdeckt.",
      ],
    },
    {
      id: "individual_rights",
      title: "Rechte von Einzelpersonen",
      paragraphs: [
        "Personen, deren PHI über HRneck verarbeitet wird, sollten Anfragen auf Auskunft, Berichtigung oder Auskunft über Offenlegungen an die Covered Entity richten, bei der sie beschäftigt sind oder die sie behandelt. Wir unterstützen die Covered Entity bei der Beantwortung dieser Anfragen, wie es die BAA vorsieht (45 CFR 164.524, 164.526 und 164.528).",
        "Wir stellen dem Secretary des U.S. Department of Health and Human Services unsere internen Praktiken, Bücher und Aufzeichnungen zur PHI zur Verfügung, damit die HIPAA-Konformität geprüft werden kann (45 CFR 164.504(e)(2)(ii)(I)).",
      ],
    },
    {
      id: "retention",
      title: "Aufbewahrung, Rückgabe und Löschung",
      paragraphs: [
        "Wir bewahren Kundeninformationen nur so lange auf, wie es für die Bereitstellung des Dienstes, die Erfüllung gesetzlicher Pflichten und die Erfüllung der BAA erforderlich ist.",
        "Wenn ein Abonnement oder eine BAA endet, geben wir alle von uns gespeicherten PHI zurück oder vernichten sie, soweit dies machbar ist (45 CFR 164.504(e)(2)(ii)(J)). Nach der Beendigung hat der Kunde [TBD: 30] Tage Zeit, seine Daten zu exportieren, bevor die Löschung beginnt. Die Löschung von Backups richtet sich nach [TBD: backup rotation period].",
        "Ist die Rückgabe oder Vernichtung nicht machbar, beschränken wir die weitere Verwendung und Offenlegung der PHI auf die Zwecke, die ihre Rückgabe oder Vernichtung unmöglich machen, und schützen sie weiterhin.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies und Sitzungen",
      paragraphs: [
        "HRneck verwendet essenzielle Cookies, damit Benutzer angemeldet bleiben und Sitzungen geschützt sind. Wir verwenden keine Werbe-Cookies von Drittanbietern. [TBD: confirm that no analytics or marketing cookies are loaded on the marketing pages.]",
      ],
    },
    {
      id: "changes",
      title: "Änderungen dieser Erklärung",
      paragraphs: [
        "Wir können diese Erklärung von Zeit zu Zeit aktualisieren. Bei wesentlichen Änderungen aktualisieren wir das Datum des Inkrafttretens und informieren Kunden mit Administratorkonten per E-Mail mindestens [TBD: 30] Tage vor dem Inkrafttreten, sofern nicht Gesetz oder BAA eine kürzere Frist verlangen.",
      ],
    },
    {
      id: "contact",
      title: "Kontakt",
      paragraphs: [
        "Datenschutz- und Sicherheitskontakt: support@hrneck.com. [TBD: name a designated privacy officer and security officer.]",
        "HRneck, San Diego, Kalifornien, USA.",
        "Personen, die der Ansicht sind, dass ihre Datenschutzrechte verletzt wurden, können sich bei der Covered Entity oder beim U.S. Department of Health and Human Services, Office for Civil Rights, beschweren.",
      ],
    },
  ],
};
