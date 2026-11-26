import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Portail apprenant",
  summary:
    "Terminez les cours assignés, regardez les leçons avec temps de visionnage enregistré, passez les quiz et suivez les notifications de formation depuis votre tableau de bord employé sur /portal.",
  keywords: [
    "apprenant",
    "learn",
    "tableau de bord",
    "quiz",
    "cours",
    "inscription",
    "watch time",
    "essay",
    "portal",
  ],
  openInAppHref: "/portal",
  overview:
    "Les employés arrivent sur leur tableau de bord /portal après la connexion. Mes cours liste la formation de sensibilisation à la sécurité qui leur est assignée : les opérateurs assignent des cours depuis /org/training, et les apprenants ouvrent chaque cours pour voir les leçons, lire les articles, regarder la vidéo téléversée ou intégrée (le temps de visionnage est reporté), ouvrir les PDF, marquer les leçons comme terminées et passer les quiz avec scores de réussite, indicateurs optionnels, compte à rebours et réponses en dissertation. Le même tableau de bord mène à Mes tickets et à la Base de connaissances. Les checklists RH n'apparaissent jamais ici. La cloche de notifications affiche les événements training_assigned avec des liens profonds vers /portal. Le forfait peut désactiver Mes cours ; le reste du tableau de bord continue de fonctionner.",
  example: {
    title: "Un analyste finance termine Phishing Essentials",
    narrative:
      "Maya ouvre /portal, voit Sensibilisation sécurité Q4 dans Mes cours à 40 %, regarde la Leçon 2 (4 minutes enregistrées), la marque comme terminée, puis passe le quiz obligatoire avec un compte à rebours de 15 minutes. Elle réussit à 88 %, laisse une dissertation sur « comment elle signalerait un appât », et le rapport de visionnage org met à jour sa ligne avant le prochain rappel.",
  },
  steps: [
    {
      title: "Se connecter sur l'hôte du tenant",
      body: "Utilisez votre compte org sur {slug}.hrneck.test. La MFA peut être requise. Les apprenants n'utilisent pas la console MSP.",
      href: "/login",
    },
    {
      title: "Ouvrir votre tableau de bord sur /portal",
      body: "Mes cours liste les formations assignées avec statut et progression. Seules les inscriptions créées par les assignations ou campagnes de formation apparaissent. Mes tickets et la Base de connaissances sont à un clic.",
      href: "/portal",
    },
    {
      title: "Terminer les leçons",
      body: "Lisez les articles, regardez la vidéo (URL ou téléversement), ouvrez les PDF et marquez chaque leçon comme terminée une fois finie.",
    },
    {
      title: "Passer les quiz",
      body: "Respectez le score de réussite, le caractère obligatoire ou optionnel et tout compte à rebours. Répondez aux questions à choix multiple et aux dissertations non notées, puis soumettez.",
    },
    {
      title: "Surveiller la cloche de notifications",
      body: "Les nouvelles assignations de formation apparaissent dans la cloche avec un lien profond vers le cours sur votre tableau de bord.",
    },
  ],
  sections: [
    {
      title: "Ce que les apprenants ne voient jamais",
      steps: [
        {
          title: "Pas de checklists RH",
          body: "Les formulaires d'intégration/de départ sont réservés aux admins sous /org/checklists. Les employés sont des enregistrements de public ; les instances de checklist sont remplies par les opérateurs RH.",
        },
        {
          title: "Pas de barre latérale admin org",
          body: "La création de cours, le lancement de campagnes et l'export du rapport de visionnage restent dans /org pour les utilisateurs disposant de org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Parcours apprenant",
    nodes: [
      { id: "assign", label: "L'org assigne un cours" },
      { id: "learn", label: "Mes cours sur /portal" },
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
      caption: "Leçon 2 sur 3 · 4 min regardées · quiz débloqué ensuite",
      progress: 66,
    },
    rows: [
      { title: "Leçon 1 · Repérer l'appât", meta: "Terminé" },
      { title: "Leçon 2 · Liens sûrs", meta: "En cours · vidéo" },
      { title: "Quiz · Signaler un phishing", meta: "Obligatoire · limite 15 min" },
    ],
    annotations: [
      { label: "Temps de visionnage", note: "La progression vidéo remonte au rapport de visionnage org." },
      { label: "Cloche", note: "Les notifications training_assigned mènent en profondeur vers /portal." },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
