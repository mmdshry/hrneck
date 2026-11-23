import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Portail apprenant",
  summary:
    "Terminez les cours assignés, regardez les leçons avec temps de visionnage enregistré, passez les quiz et suivez les notifications de formation dans /learn.",
  keywords: [
    "apprenant",
    "apprendre",
    "quiz",
    "cours",
    "inscription",
    "temps de visionnage",
    "dissertation",
    "portail",
  ],
  openInAppHref: "/learn",
  overview:
    "Le portail apprenant est l'endroit où les personnes inscrites consomment le contenu de sensibilisation à la sécurité. Les opérateurs assignent des cours depuis /org/training ; les apprenants se connectent sur l'hôte du tenant et ouvrent /learn pour voir les assignations, lire des articles, regarder de la vidéo téléversée ou intégrée (le temps de visionnage est reporté), ouvrir des PDF, marquer les leçons comme terminées et passer des quiz avec scores de réussite, indicateurs optionnels, comptes à rebours et réponses dissertation. Les checklists RH n'apparaissent jamais ici. La cloche de notifications dans l'en-tête apprenant affiche les événements training_assigned avec des liens profonds vers /learn.",
  example: {
    title: "L'analyste Finance termine Phishing Essentials",
    narrative:
      "Maya ouvre /learn, voit Sensibilisation sécurité Q4 à 40 %, regarde la Leçon 2 (4 minutes enregistrées), la marque comme terminée, puis passe le quiz obligatoire avec un compte à rebours de 15 minutes. Elle réussit à 88 %, laisse une dissertation sur « comment elle signalerait un appât », et le rapport de visionnage org met à jour sa ligne avant le prochain rappel.",
  },
  steps: [
    {
      title: "Connectez-vous sur l'hôte du tenant",
      body: "Utilisez votre compte org sur {slug}.hrneck.test. Le MFA peut être requis. Les apprenants n'utilisent pas MSP ni l'admin Filament.",
      href: "/login",
    },
    {
      title: "Ouvrez /learn",
      body: "Consultez les cours assignés avec statut et progression. Seules les inscriptions créées par les assignations ou campagnes Formation apparaissent.",
      href: "/learn",
    },
    {
      title: "Terminez les leçons",
      body: "Lisez les articles, regardez la vidéo (URL ou téléversement), ouvrez les PDF et marquez chaque leçon comme terminée une fois finie.",
    },
    {
      title: "Passez les quiz",
      body: "Respectez le score de réussite, obligatoire vs optionnel, et tout compte à rebours. Répondez aux QCM et aux dissertations non notées, puis soumettez.",
    },
    {
      title: "Observez la cloche de notifications",
      body: "Les nouvelles assignations de formation apparaissent dans la cloche de l'en-tête apprenant avec un lien profond vers le cours.",
    },
  ],
  sections: [
    {
      title: "Ce que les apprenants ne voient jamais",
      steps: [
        {
          title: "Pas de checklists RH",
          body: "Les formulaires d'onboarding/offboarding sont réservés aux admins sous /org/checklists. Les employés sont des enregistrements d'audience ; les instances de checklist sont remplies par les opérateurs RH.",
        },
        {
          title: "Pas de barre latérale d'administration org",
          body: "La rédaction de cours, le lancement de campagnes et l'export du rapport de visionnage restent dans /org pour les utilisateurs avec org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Parcours apprenant",
    nodes: [
      { id: "assign", label: "L'org assigne le cours" },
      { id: "learn", label: "Liste /learn" },
      { id: "lesson", label: "Leçon" },
      { id: "quiz", label: "Quiz" },
      { id: "report", label: "Rapport de visionnage org" },
    ],
    edges: [
      { from: "assign", to: "learn" },
      { from: "learn", to: "lesson" },
      { from: "lesson", to: "quiz" },
      { from: "quiz", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Apprenant · Mes cours",
    stats: [
      { label: "Assignés", value: "2" },
      { label: "En cours", value: "1" },
      { label: "Terminés", value: "1" },
    ],
    highlight: {
      title: "Phishing Essentials",
      caption:
        "Leçon 2 sur 3 · 4 min visionnées · quiz débloqué ensuite",
      progress: 66,
    },
    rows: [
      { title: "Leçon 1 · Repérer l'appât", meta: "Terminée" },
      { title: "Leçon 2 · Liens sûrs", meta: "En cours · vidéo" },
      {
        title: "Quiz · Signaler le phishing",
        meta: "Obligatoire · limite 15 min",
      },
    ],
    annotations: [
      {
        label: "Temps de visionnage",
        note: "La progression vidéo remonte au rapport de visionnage org.",
      },
      {
        label: "Cloche",
        note: "Les notifications training_assigned pointent en profondeur vers /learn.",
      },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
