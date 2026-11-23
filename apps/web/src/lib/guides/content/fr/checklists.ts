import type { GuideModule } from "@/lib/guides/types";

export const checklistsGuide: GuideModule = {
  slug: "checklists",
  title: "Checklists RH",
  summary:
    "Concevez des modèles réservés aux admins avec des éléments conditionnels, versionnez en toute sécurité, regroupez des packs avec auto-assignation et auditez chaque changement de réponse.",
  keywords: [
    "checklist",
    "onboarding",
    "offboarding",
    "modèle",
    "instance",
    "pack",
    "welcome pack",
    "auto-assignation",
    "audit",
    "rh",
    "visible_when",
    "requires",
    "version",
  ],
  openInAppHref: "/org/checklists",
  overview:
    "Les checklists sont des flux RH internes—pas du contenu apprenant et jamais affichés dans /learn. Les admins conçoivent des modèles flexibles, copient les cinq modèles RH système, regroupent des packs (par exemple un Welcome Pack), connectent des instances aux employés et les remplissent en tant qu'opérateurs. À l'enregistrement vous choisissez si un nouveau schéma de modèle s'applique aux instances ouvertes ou seulement aux nouvelles. Les packs publiés peuvent s'auto-assigner à la création d'un nouvel employé. Chaque changement de réponse aboutit dans le journal d'activité du tenant.",
  example: {
    title: "Welcome Pack de nouvelle embauche",
    narrative:
      "Les RH copient les modèles système Onboarding et Accès IT, ajoutent un select « Besoin d'un portable ? » qui révèle une case portable via visible_when, et une validation manager qui requires MFA enrolled. Ils publient un Welcome Pack avec auto-assignation. Lorsque alex.ng@acme.test est ajouté, les deux instances apparaissent sur le profil employé ; les opérateurs remplissent les éléments et la piste d'audit montre qui a coché l'inscription MFA.",
  },
  steps: [
    {
      title: "Ouvrez Checklists",
      body: "Parcourez les modèles personnalisés et système depuis le hub Checklists. Copiez un modèle système avant de l'assigner.",
      href: "/org/checklists",
    },
    {
      title: "Modifiez un modèle",
      body: "Utilisez le constructeur pour les types d'éléments, les règles visible_when et les dépendances requires. Enregistrez en choisissant appliquer aux ouvertes ou nouvelles uniquement.",
    },
    {
      title: "Créez un pack",
      body: "Regroupez des modèles dans un Welcome Pack et activez éventuellement l'auto-assignation à la création d'employé.",
      href: "/org/checklists/packs",
    },
    {
      title: "Connectez et remplissez",
      body: "Assignez depuis Instances ou un profil employé, complétez les éléments en tant que RH et consultez l'historique du journal d'activité.",
      href: "/org/checklists/instances",
    },
  ],
  sections: [
    {
      title: "Constructeur de modèles",
      body: "Les modèles sont des définitions de formulaire versionnées. Les employés ne les remplissent jamais—seuls les opérateurs avec org.checklists.manage.",
      steps: [
        {
          title: "Partez d'un modèle système lorsque possible",
          body: "Cinq modèles seed couvrent Onboarding employé, Offboarding employé, Provisionnement d'accès IT, Mutation interne / changement de rôle et Retour de congé. Copiez avant d'éditer pour que l'original système reste intact.",
          href: "/org/checklists",
        },
        {
          title: "Ajoutez des types d'éléments",
          body: "Types pris en charge : section, case à cocher, texte court, texte long, sélection unique, sélection multiple, date, nombre, fichier, lien et note enrichie.",
        },
        {
          title: "Utilisez visible_when pour les conditionnels",
          body: "Masquez ou affichez des éléments selon les réponses précédentes (par exemple afficher « Étiquette d'actif du portable » uniquement lorsque Besoin d'un portable = oui).",
        },
        {
          title: "Utilisez requires pour les dépendances",
          body: "Bloquez un élément jusqu'à ce qu'un autre soit terminé (par exemple la validation manager requires MFA enrolled).",
        },
        {
          title: "Ouvrez le constructeur",
          body: "Modifiez le schéma sur /org/checklists/[id]. Gardez les sections courtes pour que les opérateurs puissent parcourir rapidement les instances ouvertes.",
        },
      ],
    },
    {
      title: "Versionnage à l'enregistrement",
      body: "L'enregistrement crée une nouvelle version du modèle. Vous décidez comment le travail ouvert est affecté.",
      steps: [
        {
          title: "Choisissez appliquer aux instances ouvertes",
          body: "Poussez le nouveau schéma sur les instances encore ouvertes lorsque le changement de processus doit s'appliquer immédiatement.",
        },
        {
          title: "Ou choisissez nouvelles uniquement",
          body: "Laissez les instances ouvertes sur le schéma précédent et appliquez la nouvelle version uniquement aux assignations futures—plus sûr en milieu de vague.",
        },
      ],
    },
    {
      title: "Packs et auto-assignation",
      body: "Les packs regroupent plusieurs modèles pour une embauche ou un événement de cycle de vie unique.",
      steps: [
        {
          title: "Créez et publiez un pack",
          body: "Ajoutez des modèles, nommez le pack (Welcome Pack est le modèle courant) et publiez quand il est prêt.",
          href: "/org/checklists/packs",
        },
        {
          title: "Activez l'auto-assignation à l'embauche",
          body: "Lorsqu'elle est activée, créer un nouvel employé attache automatiquement les instances du pack. Confirmez-le sur le profil employé après import CSV ou ajout manuel.",
        },
        {
          title: "Seed Welcome Pack",
          body: "Les tenants de démonstration peuvent déjà inclure un Welcome Pack qui regroupe onboarding plus accès IT—clonez plutôt que de reconstruire.",
        },
      ],
    },
    {
      title: "Instances et audit",
      body: "Une instance est une version de modèle liée à un employé.",
      steps: [
        {
          title: "Assignez depuis Instances ou le profil employé",
          body: "Connectez un modèle ou un pack depuis /org/checklists/instances ou depuis /org/targets/[id]. La progression s'affiche sur les deux surfaces.",
          href: "/org/checklists/instances",
        },
        {
          title: "Remplissez en tant que RH",
          body: "Complétez cases, textes, sélections, dates, nombres, fichiers et liens. Les réponses fichier se téléversent sur la page de détail de l'instance.",
        },
        {
          title: "Consultez la piste d'audit",
          body: "Chaque changement de réponse est journalisé dans le journal d'activité du tenant. Utilisez l'UI d'audit de l'instance lorsque vous avez besoin de qui-a-changé-quoi pour la conformité.",
        },
      ],
    },
  ],
  diagram: {
    title: "Flux modèle, pack et employé",
    nodes: [
      { id: "template", label: "Version de modèle" },
      { id: "pack", label: "Pack de checklists" },
      { id: "target", label: "Employé" },
      { id: "instance", label: "Instance" },
      { id: "audit", label: "Piste d'audit" },
    ],
    edges: [
      { from: "template", to: "pack" },
      { from: "template", to: "instance" },
      { from: "pack", to: "instance" },
      { from: "target", to: "instance" },
      { from: "instance", to: "audit" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Instances de checklist",
    stats: [
      { label: "Ouvertes", value: "11" },
      { label: "Packs", value: "1 welcome" },
      { label: "Modèles", value: "5 système" },
    ],
    highlight: {
      title: "Welcome Pack · alex.ng@acme.test",
      caption: "Onboarding + accès IT connectés",
      progress: 78,
    },
    rows: [
      { title: "MFA enrolled", meta: "Case · Terminé" },
      {
        title: "Portable requis ?",
        meta: "Visible lorsque Besoin d'un portable = oui",
      },
      { title: "Validation manager", meta: "En attente · requires MFA" },
    ],
    annotations: [
      {
        label: "Packs",
        note: "Le Welcome Pack peut s'auto-assigner à l'embauche.",
      },
      {
        label: "Audit",
        note: "Chaque changement de réponse est journalisé dans la BD du tenant.",
      },
    ],
  },
  related: ["targets-groups", "users-roles", "reporting"],
};
