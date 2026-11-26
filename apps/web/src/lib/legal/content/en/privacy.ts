import type { LegalDocument } from "@/lib/legal/types";

export const privacyEn: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  summary:
    "How HRNECK handles protected health information and other personal data as a HIPAA Business Associate, and the safeguards we maintain.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "scope",
      title: "Scope and our role",
      paragraphs: [
        "This Privacy Policy describes how HRNECK (“HRNECK”, “we”, “us”) collects, uses, discloses, and protects information in the HRNECK Training Portal, a security awareness training platform for managed service providers (MSPs) and organizations.",
        "When a customer that is a covered entity or business associate under the Health Insurance Portability and Accountability Act of 1996 and its implementing regulations (HIPAA) uses HRNECK to create, receive, maintain, or transmit protected health information (PHI), HRNECK acts as a business associate of that customer. The Business Associate Agreement (BAA) between HRNECK and the customer is the binding document for PHI. If this policy and a BAA conflict on PHI, the BAA controls.",
        "This policy describes how we operate. It does not replace the BAA, the customer’s own notice of privacy practices, or the customer’s obligations under HIPAA.",
      ],
    },
    {
      id: "information",
      title: "Information we process",
      paragraphs: [
        "Depending on how a customer uses HRNECK, we process the following categories of information on the customer’s behalf:",
      ],
      bullets: [
        "Workforce and target records: names, work email addresses, phone numbers, locations, employee numbers, departments, and group memberships.",
        "Training records: course enrollments, progress, quiz results, and training attestations.",
        "Phishing simulation records: campaign events such as delivery, opens, clicks, and submissions.",
        "Service desk records: tickets, notes, attachments, and inbound email content sent to a configured ticketing mailbox.",
        "HR checklist records: checklist templates, instances, answers, and uploaded files.",
        "Account and authentication data: login identifiers, password hashes, multi-factor authentication (MFA) settings, passkey credentials, and single sign-on identifiers.",
        "Activity and audit records: actions taken by operators and administrators within a tenant.",
        "Technical data: IP addresses and request logs needed to operate, secure, and troubleshoot the service.",
      ],
    },
    {
      id: "phi",
      title: "Protected health information",
      paragraphs: [
        "Employment records held by a covered entity in its role as an employer are excluded from the definition of PHI (45 CFR 160.103). Workforce training and HR checklist data held by a customer as an employer are generally employment records. This exclusion does not cover health information about patients or clients that is placed in these records.",
        "Customers must not place PHI into HRNECK unless a BAA covers that use. Tickets, checklist answers, notes, uploaded files, and messages sent to the Assistant are free-text channels and must not contain PHI unless the BAA permits it.",
        "We use and disclose PHI only as the BAA permits or as required by law (45 CFR 164.502(a)).",
      ],
    },
    {
      id: "use",
      title: "How we use and disclose information",
      paragraphs: [
        "We use information only to provide, secure, support, and improve the HRNECK services for the customer, as described in the customer agreement and the BAA.",
        "We do not sell PHI, and we do not use PHI for marketing or advertising.",
        "We do not use or disclose PHI in a way that the customer could not, unless the BAA expressly permits it. Any de-identification or aggregated analysis is performed only where the BAA permits it and in accordance with 45 CFR 164.514.",
        "We disclose PHI to subcontractors only under the conditions in the subcontractors section below, and to government authorities when required by law.",
      ],
    },
    {
      id: "safeguards",
      title: "Safeguards",
      paragraphs: [
        "We maintain administrative, physical, and technical safeguards that protect the confidentiality, integrity, and availability of electronic PHI, consistent with the HIPAA Security Rule (45 CFR 164.302 to 164.318). These include:",
      ],
      bullets: [
        "Access control: unique user identifiers, role-based permissions, and least-privilege defaults for every operator account (45 CFR 164.312(a)).",
        "Automatic logoff: sessions expire after a period of inactivity. The configured session lifetime is 120 minutes [TBD: confirm the production value].",
        "Authentication: password requirements, time-based one-time passwords (TOTP), passkeys (WebAuthn), and one-time recovery codes (45 CFR 164.312(d)).",
        "Audit controls: tenant activity logs that record administrator and operator actions (45 CFR 164.312(b)). Activity logs are pruned after 180 days by default [TBD: confirm the retention setting for PHI-bearing tenants].",
        "Integrity: authenticated API access and server-side validation that protect records from improper alteration (45 CFR 164.312(c)).",
        "Transmission security: encrypted connections (TLS) for browser and API traffic (45 CFR 164.312(e)) [TBD: confirm minimum TLS version].",
        "Encryption: application-level encryption (AES-256-CBC) for stored secrets such as mailbox credentials [TBD: confirm encryption at rest for database storage and backups].",
        "Tenant isolation: each tenant’s data is stored in its own tenant database.",
        "Risk management: risk analysis and management of identified risks (45 CFR 164.308(a)(1)) [TBD: confirm review cadence].",
      ],
    },
    {
      id: "incidents",
      title: "Security incidents and breach notification",
      paragraphs: [
        "We track security incidents that affect PHI and document our response. If we discover a breach of unsecured PHI, we will notify the affected covered entity without unreasonable delay and in no case later than [TBD: 5 business days] after discovery, as required by 45 CFR 164.410. If the BAA sets a shorter period, the BAA controls.",
        "To the extent known, the notice will identify each individual whose PHI was involved, describe what happened and the types of PHI involved, describe the steps taken, and provide a contact for questions. We will update the customer as more information becomes available.",
        "Customers who suspect an incident should contact the privacy and security contact listed below immediately.",
      ],
    },
    {
      id: "subcontractors",
      title: "Subcontractors and subprocessors",
      paragraphs: [
        "We require subcontractors that create, receive, maintain, or transmit PHI on our behalf to agree in writing to the same restrictions and conditions that apply to us (45 CFR 164.502(e)(1)(ii) and 164.308(b)).",
        "[TBD: publish the subprocessor list, including hosting, database and backup, email delivery (SMTP), DNS and content delivery, and Microsoft Copilot Studio if the Assistant is enabled for a tenant.] Customers may request the current list at any time.",
        "When the Assistant is enabled, messages are sent to a third-party conversational service (Microsoft Copilot Studio). Customers must not send PHI through the Assistant unless the BAA covers this subprocessor.",
      ],
    },
    {
      id: "individual_rights",
      title: "Individual rights",
      paragraphs: [
        "Individuals whose PHI is processed through HRNECK should direct requests for access, amendment, or an accounting of disclosures to the covered entity that employs them or provides their care. We will assist the covered entity in responding to these requests as the BAA requires (45 CFR 164.524, 164.526, and 164.528).",
        "We make our internal practices, books, and records relating to PHI available to the Secretary of the U.S. Department of Health and Human Services for purposes of determining HIPAA compliance (45 CFR 164.504(e)(2)(ii)(I)).",
      ],
    },
    {
      id: "retention",
      title: "Retention, return, and destruction",
      paragraphs: [
        "We keep customer information only as long as needed to provide the service, meet legal obligations, and perform the BAA.",
        "When a subscription or BAA ends, we will return or destroy all PHI we maintain, where feasible (45 CFR 164.504(e)(2)(ii)(J)). After termination, the customer has [TBD: 30] days to export its data before deletion begins. Backup deletion follows [TBD: backup rotation period].",
        "If return or destruction is not feasible, we will limit further use and disclosure of the PHI to the purposes that make its return or destruction infeasible, and we will continue to protect it.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies and sessions",
      paragraphs: [
        "HRNECK uses essential cookies to keep users signed in and to protect sessions. We do not use third-party advertising cookies. [TBD: confirm that no analytics or marketing cookies are loaded on the marketing pages.]",
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      paragraphs: [
        "We may update this policy from time to time. For material changes, we will update the effective date and notify customers with administrator accounts by email at least [TBD: 30] days before the change takes effect, unless a shorter period is required by law or the BAA.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        "Privacy and security contact: support@hrneck.com. [TBD: name a designated privacy officer and security officer.]",
        "HRNECK, San Diego, California, United States.",
        "Individuals who believe their privacy rights have been violated may file a complaint with the covered entity or with the U.S. Department of Health and Human Services, Office for Civil Rights.",
      ],
    },
  ],
};
