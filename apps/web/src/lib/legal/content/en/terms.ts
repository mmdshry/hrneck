import type { LegalDocument } from "@/lib/legal/types";

export const termsEn: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  summary:
    "The rules for using the HRneck Training Portal, including how the Business Associate Agreement applies to protected health information.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "acceptance",
      title: "Acceptance of these terms",
      paragraphs: [
        "These Terms of Service (“Terms”) govern access to and use of the HRneck Training Portal and related services (the “Services”) provided by HRneck (“HRneck”, “we”, “us”). By creating an account, signing in, or using the Services on behalf of an organization, you agree to these Terms. If you accept them on behalf of an organization, you represent that you have authority to bind that organization.",
        "If you do not agree to these Terms, do not use the Services.",
      ],
    },
    {
      id: "definitions",
      title: "Definitions",
      paragraphs: ["In these Terms:"],
      bullets: [
        "Customer: the MSP or organization that has an agreement with HRneck for the Services.",
        "Users: people who access the Services for a Customer, including operators, administrators, learners, and service desk users.",
        "PHI: protected health information as defined in 45 CFR 160.103.",
        "BAA: a written Business Associate Agreement between HRneck and a Customer that meets 45 CFR 164.504(e) and 164.308(b).",
        "Tenant: a Customer’s isolated workspace within the Services.",
      ],
    },
    {
      id: "services",
      title: "The Services",
      paragraphs: [
        "The Services include security awareness training and campaigns, learning management, HR checklists, IT service management and ticketing, reporting and exports, learner and service portals, and optional AI assistant features. The features available to a Customer depend on its subscription plan and enabled settings. [TBD: state the availability target and support hours, or reference the service level agreement.]",
      ],
    },
    {
      id: "baa",
      title: "Business Associate Agreement and order of precedence",
      paragraphs: [
        "A Customer that is a covered entity or business associate must sign a BAA with HRneck before it creates, receives, maintains, or transmits PHI in the Services.",
        "The BAA governs how HRneck may use and disclose PHI and sets the security, breach notification, subcontractor, and return or destruction obligations. If these Terms and a BAA conflict regarding PHI, the BAA controls. In all other respects, these Terms control.",
      ],
    },
    {
      id: "phi_restrictions",
      title: "Restrictions on PHI",
      paragraphs: ["Customers and Users must comply with the following:"],
      bullets: [
        "Do not enter PHI into the Services unless a BAA that covers that use is in effect.",
        "Do not place PHI in free-text fields, ticket titles or bodies, checklist notes, uploaded files, email sent to a ticketing mailbox, or messages sent to the Assistant, unless the BAA expressly permits it.",
        "Apply the minimum necessary standard. Limit PHI to what the purpose requires.",
        "Do not use real PHI in demonstrations, test tenants, or phishing simulation content.",
        "If we reasonably believe PHI has been placed in a channel that the BAA does not cover, we may restrict the affected feature or data and will notify the Customer as soon as practicable.",
      ],
    },
    {
      id: "accounts",
      title: "Accounts and access",
      paragraphs: ["Customers and Users must follow these rules:"],
      bullets: [
        "Each User must have an individual account. Credentials must not be shared.",
        "Customers manage Users, roles, and permissions, and must remove access when a person leaves or changes role.",
        "Customers should enable MFA for all administrator and operator accounts.",
        "You are responsible for activity under your account and must promptly notify us of suspected unauthorized access.",
      ],
    },
    {
      id: "acceptable_use",
      title: "Acceptable use",
      paragraphs: ["You must not:"],
      bullets: [
        "Use the Services for unlawful purposes or to violate the rights of others.",
        "Attempt to access another Customer’s tenant, data, or accounts, or probe, scan, or test the security of the Services without our written permission.",
        "Interfere with the operation or availability of the Services, including by sending excessive automated requests.",
        "Run phishing simulations or send training only to individuals you are authorized to test or train, in compliance with applicable employment and communications laws.",
        "Upload malicious code or content that infringes the intellectual property of others.",
      ],
    },
    {
      id: "customer_responsibilities",
      title: "Customer responsibilities",
      paragraphs: [
        "Customers are responsible for the accuracy and lawfulness of the information they provide; for giving the notices and obtaining the consents required for employee training and monitoring; for configuring the Services in line with their own HIPAA policies and risk analysis; and for training their own Users.",
      ],
    },
    {
      id: "assistant",
      title: "AI assistant features",
      paragraphs: [
        "When an organization enables the Assistant, user messages and related ticket or training context may be processed by a third-party conversational service, currently Microsoft Copilot Studio. Assistant output can be inaccurate and must be reviewed before it is relied on. Do not send PHI through the Assistant unless the BAA covers this subprocessor. [TBD: confirm subprocessor status and BAA coverage for Microsoft Copilot Studio.]",
      ],
    },
    {
      id: "fees",
      title: "Fees, trials, and subscriptions",
      paragraphs: [
        "Fees, billing terms, trial periods, and plan limits are set out in the order form, the subscription plan, or the pricing shown at signup. We may suspend the Services for non-payment after reasonable notice [TBD: confirm notice period].",
      ],
    },
    {
      id: "intellectual_property",
      title: "Intellectual property",
      paragraphs: [
        "HRneck and its licensors own the Services, including the software, designs, and documentation. We grant you a limited, non-exclusive, non-transferable right to use the Services during your subscription. Customers own their data. You grant us the rights we need to host and process that data in order to provide the Services.",
      ],
    },
    {
      id: "disclaimers",
      title: "Disclaimers",
      paragraphs: [
        "To the extent permitted by law, the Services are provided “as is” and “as available”. Security awareness training and HIPAA-supporting features help reduce risk, but by themselves they do not make a Customer compliant with HIPAA or any other law.",
      ],
    },
    {
      id: "liability",
      title: "Limitation of liability",
      paragraphs: [
        "To the maximum extent permitted by law, HRneck is not liable for indirect, incidental, special, consequential, or punitive damages. Our total liability is limited to the fees the Customer paid for the Services in the twelve months before the event giving rise to the claim [TBD: confirm cap]. Where a BAA sets its own liability terms for PHI, those terms apply to PHI. Nothing in these Terms limits liability that cannot be limited by law.",
      ],
    },
    {
      id: "termination",
      title: "Termination",
      paragraphs: [
        "Either party may terminate the subscription as set out in the order form or plan. We may suspend or terminate access immediately if you materially breach these Terms or the BAA, or if continued access would create a security risk.",
        "When the subscription ends, your access ends, and HRneck will return or destroy PHI as described in the Privacy Policy and the BAA. The sections on intellectual property, disclaimers, limitation of liability, and governing law survive termination.",
      ],
    },
    {
      id: "governing_law",
      title: "Governing law and disputes",
      paragraphs: [
        "These Terms are governed by the laws of the State of California, United States, without regard to conflict-of-law rules [TBD: confirm governing law]. The state and federal courts located in San Diego County, California, have exclusive jurisdiction, unless the BAA or order form specifies otherwise.",
      ],
    },
    {
      id: "changes",
      title: "Changes to these Terms",
      paragraphs: [
        "We may update these Terms. We will update the effective date and notify administrator accounts by email at least [TBD: 30] days before material changes take effect. Continued use of the Services after the effective date means you accept the updated Terms.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        "Questions about these Terms can be sent to support@hrneck.com. Legal notices should be addressed to HRneck, San Diego, California, United States. [TBD: confirm the legal entity name and notice address.]",
      ],
    },
  ],
};
