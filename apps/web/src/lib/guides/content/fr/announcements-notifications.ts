import type { GuideModule } from "@/lib/guides/types";

export const announcementsNotificationsGuide: GuideModule = {
  slug: "announcements-notifications",
  title: "Annonces et notifications",
  summary:
    "Publiez des annonces à l'échelle de l'organisation et comprenez comment la cloche in-app affiche les événements de formation, checklist et tickets.",
  keywords: [
    "annonces",
    "notifications",
    "cloche",
    "publier",
    "alertes",
  ],
  openInAppHref: "/org/announcements",
  overview:
    "Les annonces permettent aux opérateurs de diffuser des messages titre/corps à l'organisation. La cloche de notifications (dans l'environnement org) agrège les événements formation assignée, checklist assignée, ticket assigné et annonces avec liens profonds—mis à jour en direct via Reverb sans actualisation manuelle.",
  example: {
    title: "Avis de formation obligatoire",
    narrative:
      "Après avoir lancé Sensibilisation sécurité Q4, Mira publie « Terminez la formation phishing avant vendredi », et les opérateurs Finance voient à la fois l'annonce et les notifications individuelles de formation assignée dans la cloche avec des liens vers /portal ou la progression de campagne.",
  },
  steps: [
    {
      title: "Ouvrez Annonces",
      body: "Créez un titre et un corps clairs pour le message à l'échelle de l'organisation.",
      href: "/org/announcements",
    },
    {
      title: "Publiez",
      body: "Publier diffuse des notifications in-app aux opérateurs éligibles.",
    },
    {
      title: "Observez la cloche",
      body: "La cloche de notifications de l'environnement liste les événements récents ; cliquez pour ouvrir la ressource liée.",
    },
    {
      title: "Corrèlez avec les événements de module",
      body: "Les assignations de formation, checklist et ticket apparaissent aussi dans la même cloche sans annonce séparée.",
    },
  ],
  diagram: {
    title: "Diffusion des notifications",
    nodes: [
      { id: "event", label: "Événement de module" },
      { id: "announce", label: "Annonce" },
      { id: "bell", label: "Cloche de notifications" },
      { id: "deep", label: "Lien profond" },
    ],
    edges: [
      { from: "event", to: "bell" },
      { from: "announce", to: "bell" },
      { from: "bell", to: "deep" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Notifications",
    stats: [
      { label: "Non lues", value: "4" },
      { label: "Annonces", value: "1 nouvelle" },
      { label: "Formation", value: "2 assignées" },
    ],
    highlight: {
      title: "Terminez la formation phishing avant vendredi",
      caption: "Publié 10:02 · visible à l'échelle org",
      progress: 100,
    },
    rows: [
      {
        title: "Formation assignée · Phishing Essentials",
        meta: "Lien profond · /portal",
      },
      {
        title: "Ticket assigné · INC-1842",
        meta: "Lien profond · ticketing",
      },
      {
        title: "Checklist assignée · Accès IT",
        meta: "Lien profond · instances",
      },
    ],
    annotations: [
      {
        label: "Cloche",
        note: "Vit dans l'en-tête de l'environnement org pour les utilisateurs connectés.",
      },
      {
        label: "Temps réel",
        note: "Le polling couvre les lacunes lorsque le WebSocket est hors ligne.",
      },
    ],
  },
  related: ["training", "ticketing", "checklists"],
};
