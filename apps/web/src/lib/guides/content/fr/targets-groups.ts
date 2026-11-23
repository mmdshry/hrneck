import type { GuideModule } from "@/lib/guides/types";

export const targetsGroupsGuide: GuideModule = {
  slug: "targets-groups",
  title: "Employés, départements et groupes",
  summary:
    "Construisez l'audience employés avec CRUD, un assistant de mapping CSV, des départements, des groupes et des scores de risque.",
  keywords: [
    "employés",
    "cibles",
    "départements",
    "groupes",
    "csv",
    "audience",
    "risque",
  ],
  openInAppHref: "/org/targets",
  overview:
    "Les employés (Targets) sont l'audience de formation et de checklists et sont appariés à des Users de connexion (généralement le rôle learner)—ce ne sont pas des opérateurs org. Gérez les employés sur Employés (CRUD et assistant CSV), ouvrez un profil employé pour voir les checklists connectées, maintenez les départements comme liste gérée pour les formulaires, puis organisez-les en Groupes avec un sélecteur de membres afin que les campagnes ciblent des départements entiers. Archivez un groupe en soft-delete via status=inactive. Les packs de checklists publiés avec auto-assignation créent des instances lors de l'ajout d'un nouvel employé.",
  example: {
    title: "Import CSV Finance avant le Q4",
    narrative:
      "Priya ouvre Importer les employés, téléverse finance-q4.csv (186 lignes), mappe Email Address → email et enregistre un modèle RH, prévisualise les comptages créer/mettre à jour, valide l'import, puis confirme que les checklists Welcome Pack ont été auto-assignées sur le profil d'une nouvelle embauche.",
  },
  steps: [
    {
      title: "Ouvrez Employés",
      body: "Importez les employés et consultez les scores de risque depuis l'espace Employés.",
      href: "/org/targets",
    },
    {
      title: "Gérez les départements",
      body: "Créez et maintenez les départements sur la page Départements, puis sélectionnez-les lors de l'ajout ou de l'import d'employés.",
      href: "/org/departments",
    },
    {
      title: "Créez ou importez des employés",
      body: "Ajoutez ou modifiez une personne avec le formulaire employé (titre, manager, date d'embauche, téléphone, lieu, type d'emploi, langue, fuseau horaire, risque). Utilisez Importer les employés pour un assistant : téléversez n'importe quel CSV entreprise, mappez les colonnes aux champs plateforme (e-mail requis), enregistrez éventuellement un modèle de mapping par tenant, prévisualisez les erreurs de ligne, puis validez. Les packs d'auto-assignation attachent les checklists d'onboarding et préremplissent rôle/début/manager depuis le profil.",
    },
    {
      title: "Ouvrez un profil employé",
      body: "Utilisez Ouvrir sur une ligne pour consulter les checklists connectées et connecter un modèle ou un pack depuis le profil.",
    },
    {
      title: "Ouvrez Groupes",
      body: "Créez des groupes d'audience séparément de la liste des employés.",
      href: "/org/groups",
    },
    {
      title: "Choisissez les membres dans la modale du groupe",
      body: "Nommez le groupe et sélectionnez les employés avec le sélecteur de membres afin que les campagnes ciblent des départements entiers.",
    },
  ],
  diagram: {
    title: "Flux de préparation de l'audience",
    nodes: [
      { id: "csv", label: "CSV / CRUD" },
      { id: "depts", label: "Départements" },
      { id: "groups", label: "Groupes" },
      { id: "risk", label: "Scores de risque" },
      { id: "ready", label: "Prêt pour campagne" },
    ],
    edges: [
      { from: "csv", to: "depts" },
      { from: "depts", to: "groups" },
      { from: "groups", to: "risk" },
      { from: "risk", to: "ready" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Employés",
    stats: [
      { label: "Employés", value: "186" },
      { label: "Départements", value: "6" },
      { label: "Groupes", value: "8" },
      { label: "Risque élevé", value: "2" },
    ],
    highlight: {
      title: "Département Finance",
      caption: "Import CSV réussi · 186 employés prêts",
      progress: 100,
    },
    rows: [
      { title: "alex.ng@acme.test", meta: "Finance · Risque élevé" },
      { title: "maya.cole@acme.test", meta: "Finance · Risque moyen" },
      { title: "ops-all", meta: "Groupe · 64 membres" },
    ],
    annotations: [
      {
        label: "CSV",
        note: "L'assistant mappe les colonnes, simule les erreurs de ligne, fait un upsert par e-mail et crée les départements par nom si besoin.",
      },
      {
        label: "Groupes",
        note: "Utilisez le sélecteur de membres pour que les campagnes ciblent des départements entiers.",
      },
    ],
  },
  related: ["training", "checklists", "getting-started"],
};
