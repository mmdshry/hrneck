import type { GuideModule } from "@/lib/guides/types";

export const servicePortalGuide: GuideModule = {
  slug: "service-portal",
  title: "Portail de service",
  summary:
    "Soumettez et suivez vos propres tickets, ajoutez des notes et parcourez les articles publiés de la base de connaissances depuis /portal.",
  keywords: [
    "portail",
    "tickets",
    "kb",
    "base de connaissances",
    "service desk",
    "utilisateur final",
    "soumettre",
  ],
  openInAppHref: "/portal/tickets",
  overview:
    "Le portail de service est la face employé du ticketing. L'accès tenant utilise org.ticketing.portal—le rôle learner seed n'inclut que cette permission—ainsi les Users employés appariés peuvent ouvrir /portal pour lister et soumettre des tickets, ajouter des notes sur leurs propres demandes et parcourir les articles KB publiés. Les techniciens travaillent toujours la file dans /org/ticketing. L'en-tête du portail lie toujours Mes tickets, Base de connaissances et Learn ; Technicien n'apparaît que lorsque l'utilisateur connecté a aussi org.ticketing.tickets ou org.ticketing.admin (pas pour les comptes learner uniquement).",
  example: {
    title: "L'employé signale une facture suspecte",
    narrative:
      "Alex se connecte avec un compte learner, ouvre /portal/tickets, soumet « PDF de facture suspecte » avec une courte description, ajoute plus tard une note avec une capture d'écran, puis trouve l'article KB publié « Comment signaler le phishing » sous /portal/kb après que le service desk a converti INC-1842.",
  },
  steps: [
    {
      title: "Connectez-vous",
      body: "Utilisez votre compte tenant. Les API du portail nécessitent org.ticketing.portal ; le rôle learner seed accorde exactement cela (pas d'accès à la file org).",
      href: "/login",
    },
    {
      title: "Ouvrez Mes tickets",
      body: "/portal redirige vers les tickets. Listez vos demandes et ouvrez-en une pour le détail.",
      href: "/portal/tickets",
    },
    {
      title: "Soumettez une demande",
      body: "Créez un nouveau ticket avec un titre et une description clairs. Il arrive dans la file du bureau org pour les techniciens.",
    },
    {
      title: "Ajoutez des notes sur votre ticket",
      body: "Complétez avec plus de détail depuis la page de détail du ticket sans avoir besoin de l'UI ticketing org.",
    },
    {
      title: "Parcourez la KB publiée",
      body: "Ouvrez /portal/kb pour les articles que le service desk a publiés. Les brouillons restent invisibles ici.",
      href: "/portal/kb",
    },
  ],
  sections: [
    {
      title: "Portail vs file org",
      steps: [
        {
          title: "Les employés restent dans /portal",
          body: "N'attendez pas l'administration des bureaux, la fusion en masse, les éditeurs SLA ni les lecteurs e-mail dans le portail—ce sont des outils opérateur.",
        },
        {
          title: "Les techniciens utilisent /org/ticketing",
          body: "Triage, SLA, ingestion IMAP et conversion ticket→KB vivent dans l'app org. Voir le guide ticketing ITIL.",
          href: "/org/ticketing",
        },
        {
          title: "Raccourcis de l'en-tête",
          body: "Utilisez Learn pour les assignations de formation. Technicien n'apparaît que si vous avez org.ticketing.tickets ou org.ticketing.admin—les utilisateurs learner uniquement restent dans /portal.",
        },
      ],
    },
  ],
  diagram: {
    title: "Flux de demande du portail",
    nodes: [
      { id: "user", label: "Utilisateur du portail" },
      { id: "ticket", label: "Mon ticket" },
      { id: "queue", label: "File org" },
      { id: "kb", label: "KB publiée" },
    ],
    edges: [
      { from: "user", to: "ticket" },
      { from: "ticket", to: "queue" },
      { from: "queue", to: "kb", label: "convertir" },
      { from: "kb", to: "user" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Portail · Mes tickets",
    stats: [
      { label: "Ouverts", value: "1" },
      { label: "Résolus", value: "3" },
      { label: "KB", value: "Publiée" },
    ],
    highlight: {
      title: "PDF de facture suspecte",
      caption: "En attente du service desk · note ajoutée 10:21",
      progress: 35,
    },
    rows: [
      { title: "Ma demande · PDF de facture suspecte", meta: "Ouverte" },
      { title: "KB · Comment signaler le phishing", meta: "Publiée" },
      { title: "En-tête · Learn", meta: "Assignations de formation" },
    ],
    annotations: [
      {
        label: "Périmètre",
        note: "Vous ne voyez que vos propres tickets dans le portail.",
      },
      {
        label: "KB",
        note: "Seuls les articles publiés apparaissent sous /portal/kb.",
      },
    ],
  },
  related: ["ticketing", "learner-portal", "auth"],
};
