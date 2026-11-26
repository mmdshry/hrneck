import type { GuideModule } from "@/lib/guides/types";

export const ticketingGuide: GuideModule = {
  slug: "ticketing",
  title: "Ticketing ITIL et KB",
  summary:
    "Gérez les bureaux Incident, Problem, Service Request et Change avec SLA, opérations en masse, ingestion e-mail, KB, recherche et rapports CSV/JSON.",
  keywords: [
    "ticketing",
    "incident",
    "sla",
    "kb",
    "e-mail",
    "bureau",
    "service desk",
    "masse",
    "imap",
    "escalade",
    "procédures",
    "préférences",
    "fusionner",
  ],
  openInAppHref: "/org/ticketing",
  overview:
    "Le module ticketing couvre les bases du service desk ITIL pour les opérateurs dans /org/ticketing : bureaux, tickets avec notes/tâches/pièces jointes, actions en masse, procédures et escalade, politiques SLA, lecteurs e-mail IMAP, articles KB (y compris la conversion ticket→KB), Tout rechercher, préférences et rapports CSV/PDF/JSON. Les employés soumettent et suivent le travail dans le portail de service séparé (/portal)—voir ce guide pour les étapes utilisateur final. Les permissions se répartissent entre org.ticketing.tickets, .admin, .reports et .portal, avec les rôles seed sd_* / kb_admin. Les articles KB ont leur propre section (/org/kb) avec les permissions org.kb.view et org.kb.manage.",
  example: {
    title: "Un signalement de phishing devient un article KB",
    narrative:
      "Le technicien Lee crée l'Incident INC-1842 « PDF de facture suspecte », ajoute une note et une tâche de confinement, joint l'échantillon, le résout sous SLA, convertit le ticket en article KB « Comment signaler le phishing », confirme Tout rechercher et la KB publiée du portail, puis télécharge le CSV ticketing hebdomadaire pour le standup du service desk.",
  },
  steps: [
    {
      title: "Ouvrez la file de tickets",
      body: "Filtrez par bureau, étape, assigné et état archivé depuis le hub ticketing.",
      href: "/org/ticketing",
    },
    {
      title: "Triagez un ticket",
      body: "Capturez notes, tâches et pièces jointes ; déplacez les étapes ; copiez ou liez les tickets associés selon les besoins.",
    },
    {
      title: "Configurez bureaux, SLA et e-mail",
      body: "Examinez les bureaux ITIL, procédures et SLA sous Bureaux ; branchez les lecteurs IMAP sous E-mail.",
      href: "/org/ticketing/desks",
    },
    {
      title: "Publiez la connaissance et exportez",
      body: "Convertissez les tickets résolus en KB, vérifiez Tout rechercher / la visibilité portail, puis exportez des packages CSV/PDF ou JSON.",
      href: "/org/kb",
    },
  ],
  sections: [
    {
      title: "Triage de la file",
      body: "Les opérateurs avec org.ticketing.tickets travaillent la file en direct. Les bureaux incluent Incident, Problem, Service Request, Change, plus un type de bureau Knowledge Base.",
      steps: [
        {
          title: "Créez ou ouvrez un ticket",
          body: "Définissez étape, statut, priorité, sévérité, catégorie et assigné. Les préfixes de numéro viennent de la configuration du bureau.",
          href: "/org/ticketing",
        },
        {
          title: "Ajoutez notes, tâches et pièces jointes",
          body: "Les notes capturent le travail ; les tâches supportent un bascule terminé ; les pièces jointes se téléversent et téléchargent depuis la page de détail du ticket.",
        },
        {
          title: "Copiez ou liez des tickets",
          body: "Copiez un ticket lorsque vous avez besoin d'une piste parallèle ; liez les tickets associés pour garder connectés les enregistrements incident et problème.",
        },
      ],
    },
    {
      title: "Actions en masse et préférences",
      steps: [
        {
          title: "Exécutez des actions en masse",
          body: "Depuis la file, archivez, désarchivez, marquez lu/non lu, arrêtez les notifications, supprimez, fusionnez, mettez à jour en groupe, liez ou déverrouillez en masse. Utilisez le filtre archivés pour trouver le travail en masse fermé.",
        },
        {
          title: "Définissez les préférences",
          body: "Configurez le délai de notification, la portée de notification et le bureau par défaut pour que le nouveau travail arrive où l'équipe l'attend.",
        },
      ],
    },
    {
      title: "Bureaux, SLA et procédures",
      body: "L'administration des bureaux nécessite org.ticketing.admin. Étapes, lignes de support, procédures, SLA et modèles vivent sous Bureaux.",
      steps: [
        {
          title: "Modifiez bureaux et étapes",
          body: "Créez ou modifiez les bureaux, la séquence d'étapes, les indicateurs d'escalade et les étapes terminales. Maintenez statuts, priorités, sévérités et catégories comme lignes de support.",
          href: "/org/ticketing/desks",
        },
        {
          title: "Attachez des procédures",
          body: "Liez des procédures aux événements de création, d'entrée d'étape ou d'escalade pour que les techniciens reçoivent des playbooks cohérents.",
        },
        {
          title: "Définissez les politiques SLA",
          body: "Fixez les minutes de réponse et de résolution par priorité. Les jobs d'escalade avancent le niveau lorsque escalation_due_at est dépassé.",
        },
        {
          title: "Maintenez les modèles de message et de note",
          body: "Réutilisez des modèles pour les réponses courantes et les notes internes afin de garder ton et étapes cohérents.",
        },
      ],
    },
    {
      title: "Ingestion e-mail",
      steps: [
        {
          title: "Configurez un lecteur e-mail",
          body: "Créez, modifiez ou supprimez des lecteurs sous E-mail. Utilisez l'ingestion de test pour prouver qu'un message d'exemple devient un ticket.",
          href: "/org/ticketing/email",
        },
        {
          title: "Comptez sur le sondeur IMAP",
          body: "Le sondeur crée des tickets à partir du courrier entrant. Les notifications différées font partie du même pipeline—réglez le délai dans les préférences si l'équipe est saturée.",
        },
      ],
    },
    {
      title: "Base de connaissances et Tout rechercher",
      steps: [
        {
          title: "Rédigez et publiez des articles",
          body: "Créez, modifiez, publiez/dépubliez ou supprimez des articles KB. Les brouillons non publiés restent hors du portail employé.",
          href: "/org/kb",
        },
        {
          title: "Convertissez ticket → KB",
          body: "Après résolution, convertissez un ticket en article pour que le correctif devienne une connaissance searchable.",
        },
        {
          title: "Utilisez Tout rechercher",
          body: "Recherchez tickets et KB ensemble depuis /org/ticketing/search lorsque vous ne savez pas si la réponse est un incident ouvert ou un article publié.",
          href: "/org/ticketing/search",
        },
      ],
    },
    {
      title: "Rapports et packages",
      steps: [
        {
          title: "Téléchargez des résumés CSV ou PDF",
          body: "Les métriques ouverts, résolus, violation de réponse et de résolution s'exportent depuis les rapports ticketing.",
          href: "/org/ticketing/reports",
        },
        {
          title: "Import/export JSON (admin)",
          body: "Exportez ou importez des tickets sélectionnés comme packages JSON lors de migrations ou de clonage de données de bureau. Nécessite la permission d'administration ticketing.",
        },
      ],
    },
  ],
  diagram: {
    title: "Boucle du ticket à la connaissance",
    nodes: [
      { id: "intake", label: "E-mail / portail / agent" },
      { id: "ticket", label: "Ticket" },
      { id: "sla", label: "SLA + escalade" },
      { id: "resolve", label: "Résoudre" },
      { id: "kb", label: "Article KB" },
      { id: "portal", label: "Portail de service" },
    ],
    edges: [
      { from: "intake", to: "ticket" },
      { from: "ticket", to: "sla" },
      { from: "sla", to: "resolve" },
      { from: "resolve", to: "kb" },
      { from: "kb", to: "portal" },
      { from: "portal", to: "intake", label: "nouvelle demande" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Bureau Incident",
    stats: [
      { label: "En attente", value: "5" },
      { label: "Violations", value: "0" },
      { label: "Consultations KB", value: "128" },
    ],
    highlight: {
      title: "INC-1842 · PDF de facture suspecte",
      caption: "Étape En cours · SLA 4 h restantes",
      progress: 55,
    },
    rows: [
      { title: "Note · Pièce jointe mise en quarantaine", meta: "Lee · 10:14" },
      { title: "Tâche · Réinitialiser les règles boîte mail", meta: "Ouverte" },
      { title: "Convertir en KB", meta: "Disponible après résolution" },
    ],
    annotations: [
      {
        label: "Bureaux",
        note: "Les bureaux ITIL partagent des modèles d'étapes mais gardent des files séparées.",
      },
      {
        label: "Portail",
        note: "Les employés soumettent via /portal/tickets, pas la file org.",
      },
    ],
  },
  related: [
    "service-portal",
    "announcements-notifications",
    "reporting",
    "users-roles",
  ],
};
