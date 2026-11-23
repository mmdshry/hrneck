import type { GuideModule } from "@/lib/guides/types";

export const dashboardGuide: GuideModule = {
  slug: "dashboard",
  title: "Tableau de bord de l'organisation",
  summary:
    "Consultez les métriques en direct des modules autorisés par vos permissions, puis accédez aux flux qui demandent de l'attention.",
  keywords: [
    "tableau de bord",
    "métriques",
    "en direct",
    "aperçu",
    "permissions",
    "posture",
  ],
  openInAppHref: "/org",
  overview:
    "Le tableau de bord de l'organisation affiche des widgets de métriques filtrés par permissions—achèvement et risque de formation, checklists ouvertes, pression ticketing et effectifs—plutôt qu'un menu fixe de raccourcis. Les opérateurs avec org.reports.view obtiennent un aperçu en direct du canal de rapports détaillés ; les autres voient des comptages par module lorsque disponibles.",
  example: {
    title: "Revue de posture du lundi",
    narrative:
      "Avant le standup, Jordan ouvre /org et voit l'achèvement de la formation à 86 %, des checklists ouvertes et la pression SLA sur le widget ticketing. Ils passent directement à Formation, puis Ticketing, sans chercher une grille générique de raccourcis.",
  },
  steps: [
    {
      title: "Ouvrez le tableau de bord",
      body: "Allez dans Organisation → Tableau de bord. Les widgets reflètent uniquement le tenant connecté et vos permissions.",
      href: "/org",
    },
    {
      title: "Lisez les widgets que vous voyez",
      body: "Formation (rapports ou gestion de formation), Checklists, Ticketing et Personnes n'apparaissent que si vous avez la permission correspondante.",
    },
    {
      title: "Accédez directement au travail",
      body: "Chaque widget renvoie vers son module pour agir sans l'ancien menu de raccourcis.",
    },
    {
      title: "Faites confiance au rafraîchissement en direct lorsque les rapports sont autorisés",
      body: "Avec org.reports.view, les instantanés reports-detailed de Reverb maintiennent les cartes à jour. Si le socket tombe, l'interface affiche Synchronisation en direct indisponible et se reconnecte automatiquement—il n'y a pas de bouton Actualiser.",
    },
  ],
  diagram: {
    title: "Flux d'information du tableau de bord",
    nodes: [
      { id: "perms", label: "Permissions" },
      { id: "api", label: "API de l'org" },
      { id: "ws", label: "Canal en direct" },
      { id: "cards", label: "Widgets de métriques" },
    ],
    edges: [
      { from: "perms", to: "cards", label: "filtre" },
      { from: "api", to: "cards", label: "instantané" },
      { from: "ws", to: "cards", label: "mis à jour" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Tableau de bord org",
    stats: [
      { label: "Achèvement", value: "86%" },
      { label: "Checklists ouvertes", value: "3" },
      { label: "Tickets ouverts", value: "14" },
    ],
    highlight: {
      title: "Posture de formation · Cette semaine",
      caption:
        "412 assignés · Finance encore en retard · Destinataires sans action signalés",
      progress: 86,
    },
    rows: [
      { title: "Formation", meta: "86 % terminé · 2 campagnes en cours" },
      { title: "Checklists", meta: "3 instances ouvertes" },
      { title: "Ticketing", meta: "14 ouverts · surveillance SLA" },
    ],
    annotations: [
      {
        label: "Filtre de permissions",
        note: "Les widgets se masquent lorsque la permission org.* correspondante manque.",
      },
      {
        label: "Liens profonds",
        note: "Un clic vers Formation, Checklists, Ticketing ou Utilisateurs.",
      },
    ],
  },
  related: ["training", "reporting", "targets-groups"],
};
