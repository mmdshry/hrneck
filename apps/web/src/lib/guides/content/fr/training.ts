import type { GuideModule } from "@/lib/guides/types";

export const trainingGuide: GuideModule = {
  slug: "training",
  title: "Formation de sensibilisation à la sécurité",
  summary:
    "Créez des cours et des quiz, assignez du contenu, lancez des campagnes de rappel et exportez la progression par leçon pour les parties prenantes.",
  keywords: [
    "formation",
    "lms",
    "campagne",
    "cours",
    "quiz",
    "assigner",
    "rappel",
    "temps de visionnage",
    "dissertation",
    "export pdf",
    "annuler",
    "archiver",
  ],
  openInAppHref: "/org/training",
  overview:
    "Cours héberge la bibliothèque (leçons article, vidéo et PDF plus quiz). Formation assigne un ou plusieurs cours aux employés et/ou groupes, exécute des campagnes qui mettent en file un rappel e-mail unique par destinataire au lancement (via SMTP et profils d'envoi), et examine la progression par leçon avec export CSV ou PDF. Les apprenants consomment le contenu assigné dans le portail apprenant sur /learn—pas dans la file org. Une liste d'exemple secondaire existe sur /org/campaigns pour les démos rapides ; le flux opérateur vit sous Formation → Campagnes.",
  example: {
    title: "Campagne de sensibilisation Q4 Finance Acme",
    narrative:
      "Ops construit Phishing Essentials avec trois leçons et un quiz obligatoire (80 % de réussite, limite 15 minutes, une dissertation). Depuis Formation ils assignent le cours au groupe Finance (186 personnes), lancent Sensibilisation sécurité Q4 (un e-mail de rappel mis en file par destinataire), voient l'achèvement passer de 12 % à 86 %, puis exportent le PDF du rapport de visionnage pour la direction.",
  },
  steps: [
    {
      title: "Construisez la bibliothèque de cours",
      body: "Créez cours et leçons sur Cours avant toute assignation. Ajoutez des quiz avec score de réussite, indicateur obligatoire, limite de temps, QCM et questions dissertation optionnelles.",
      href: "/org/courses",
    },
    {
      title: "Assignez le contenu",
      body: "Sur Formation, sélectionnez un ou plusieurs cours et assignez-les aux employés et/ou groupes. Les apprenants voient les inscriptions dans /learn après l'assignation.",
      href: "/org/training",
    },
    {
      title: "Créez une campagne",
      body: "Nommez la campagne, choisissez le contenu, sélectionnez group_ids et/ou targets, puis lancez. Le lancement met en file un job de rappel par destinataire—il n'y a pas de cadence hebdomadaire. Confirmez d'abord SMTP et le profil d'envoi.",
      href: "/org/training/campaigns",
    },
    {
      title: "Surveillez et exportez",
      body: "Suivez l'inscription, le statut des leçons, le temps de visionnage et les horodatages. Téléchargez CSV ou PDF depuis le rapport de visionnage, puis annulez (arrête les jobs de rappel en attente) ou archivez les campagnes à la fin de la vague.",
    },
  ],
  sections: [
    {
      title: "Bibliothèque de cours",
      body: "Tout ce que les apprenants ouvriront plus tard est rédigé ici. Gardez des titres clairs et des quiz alignés sur les leçons qui suivent.",
      steps: [
        {
          title: "Créez un cours",
          body: "Définissez le titre, la description et la durée attendue. Les cours sont l'unité que vous assignez et utilisez en campagne.",
          href: "/org/courses",
        },
        {
          title: "Ajoutez des leçons",
          body: "Utilisez des leçons article/texte, vidéo (URL YouTube/Vimeo ou fichier téléversé), audio ou document (PDF, TXT, MD, DOC, DOCX) jusqu'à 100 Mo. Ordonnez les leçons dans la séquence que les apprenants doivent suivre.",
        },
        {
          title: "Configurez les quiz",
          body: "Ajoutez un ou plusieurs quiz par cours. Définissez le score de réussite, marquez obligatoire vs optionnel, ajoutez éventuellement un compte à rebours, mélangez des QCM et incluez des dissertations non notées lorsque vous avez besoin de réponses en texte libre.",
        },
        {
          title: "Téléversez et diffusez les médias",
          body: "Utilisez Aperçu sur Cours pour confirmer que vidéo/audio se diffusent et que les documents s'ouvrent avant d'assigner une grande audience, afin que le premier rappel ne touche pas un contenu cassé.",
        },
      ],
    },
    {
      title: "Assigner et suivre",
      body: "L'assignation crée des inscriptions. Le suivi est par apprenant et par leçon—pas seulement les totaux de l'entonnoir de campagne.",
      steps: [
        {
          title: "Assignez un ou plusieurs cours",
          body: "Depuis Formation, choisissez les cours et ciblez employés et/ou groupes. Vous pouvez assigner un élément complet de la bibliothèque ; les campagnes restent la voie pour les vagues temporisées avec rappels.",
          href: "/org/training",
        },
        {
          title: "Ouvrez le rapport de visionnage",
          body: "Inspectez le statut de leçon par apprenant, le temps de visionnage et les horodatages opened-at et completed-at pour relancer les retardataires par nom.",
        },
        {
          title: "Exportez CSV ou PDF",
          body: "Téléchargez le rapport de visionnage en CSV pour les tableurs ou en PDF pour les packs parties prenantes. Associez-le à Rapports pour les calendriers à l'échelle org.",
        },
        {
          title: "Orientez les apprenants vers /learn",
          body: "Les opérateurs restent dans /org/training. Les apprenants ouvrent le portail apprenant pour lire, regarder, marquer comme terminé et passer les quiz. Voir le guide Portail apprenant.",
          href: "/learn",
        },
      ],
    },
    {
      title: "Campagnes et rappels",
      body: "Les campagnes regroupent contenu + audience + un rappel unique au lancement. Les statuts incluent draft, scheduled, running, completed, cancelled et archived.",
      steps: [
        {
          title: "Lancez depuis Formation → Campagnes",
          body: "Nommez la vague, attachez le contenu du cours, sélectionnez groupes/employés et lancez. Chaque destinataire reçoit un job de rappel—sans cadence hebdomadaire récurrente.",
          href: "/org/training/campaigns",
        },
        {
          title: "Confirmez le chemin de livraison",
          body: "Le mail de rappel utilise le SMTP de l'org et le profil d'envoi actif. Vérifiez Intégrations et Profils d'envoi avant le premier envoi.",
          href: "/org/settings/integrations",
        },
        {
          title: "Lisez l'entonnoir de campagne",
          body: "Suivez les inscriptions, en cours, terminés, % ouverts et % terminés sur la carte de campagne à mesure que les apprenants finissent les leçons.",
        },
        {
          title: "Annulez ou archivez",
          body: "Annulez une vague en brouillon, planifiée ou en cours pour que les jobs de rappel en attente ne s'exécutent pas ; archivez (PATCH ou DELETE pour running/completed) pour garder la liste propre sans supprimer l'historique.",
        },
        {
          title: "Connaissez la page des campagnes d'exemple",
          body: "/org/campaigns est une liste secondaire « lancer une campagne d'exemple » (org.campaigns.manage). Elle n'est pas dans la barre latérale ; préférez Formation → Campagnes pour les vagues de production.",
          href: "/org/campaigns",
        },
      ],
    },
  ],
  diagram: {
    title: "Cycle de vie de la campagne",
    nodes: [
      { id: "library", label: "Cours" },
      { id: "audience", label: "Targets / groupes" },
      { id: "campaign", label: "Campagne" },
      { id: "mail", label: "Rappels" },
      { id: "learn", label: "Portail apprenant" },
      { id: "metrics", label: "Progression + export" },
    ],
    edges: [
      { from: "library", to: "campaign" },
      { from: "audience", to: "campaign" },
      { from: "campaign", to: "mail" },
      { from: "campaign", to: "learn" },
      { from: "learn", to: "metrics" },
      { from: "mail", to: "metrics" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Campagnes de formation",
    stats: [
      { label: "Achèvement", value: "86%" },
      { label: "Assignés", value: "186" },
      { label: "Rappels", value: "Unique" },
    ],
    highlight: {
      title: "Sensibilisation sécurité Q4",
      caption: "Groupe Finance · Phishing Essentials · 38 en retard",
      progress: 86,
    },
    rows: [
      {
        title: "Leçon 1 · Repérer l'appât",
        meta: "92 % terminé · 4 min de visionnage moyen",
      },
      {
        title: "Quiz · Signaler le phishing",
        meta: "81 % de réussite · obligatoire · 15 min",
      },
      {
        title: "Exporter le rapport de visionnage",
        meta: "CSV + PDF prêts",
      },
    ],
    annotations: [
      {
        label: "Carte de campagne",
        note: "Les métriques de l'entonnoir se mettent à jour à mesure que les apprenants terminent les leçons.",
      },
      {
        label: "Rappels",
        note: "Un job par destinataire au lancement ; annuler arrête les envois en attente.",
      },
    ],
  },
  related: ["learner-portal", "targets-groups", "settings", "reporting"],
};
