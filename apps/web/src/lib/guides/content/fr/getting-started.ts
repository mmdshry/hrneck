import type { GuideModule } from "@/lib/guides/types";

export const gettingStartedGuide: GuideModule = {
  slug: "getting-started",
  title: "Premiers pas",
  summary:
    "Connectez-vous en tant qu'administrateur d'organisation, découvrez l'environnement du tenant et suivez le parcours recommandé de la première semaine.",
  keywords: [
    "intégration",
    "connexion",
    "démo",
    "rôles",
    "hôtes",
    "démarrer",
  ],
  openInAppHref: "/org",
  overview:
    "Les espaces de travail tenant HRneck s'exécutent sur {slug}.hrneck.test (ou l'alias app.hrneck.test). Les administrateurs d'organisation utilisent la barre latérale gauche pour gérer la formation, les employés, les checklists, le ticketing, les rapports, les utilisateurs et les paramètres. Les guides restent publics afin que vous puissiez examiner les flux avant de vous connecter.",
  example: {
    title: "Première connexion d'Acme Corp",
    narrative:
      "Sara (org_admin@acme.test) ouvre acme.hrneck.test, se connecte avec son compte protégé par MFA, arrive sur le tableau de bord de l'organisation et utilise les Guides pour confirmer SMTP et les employés avant de lancer la campagne de sensibilisation du Q4.",
  },
  steps: [
    {
      title: "Ouvrez l'hôte de votre tenant",
      body: "Utilisez {slug}.hrneck.test pour votre organisation. Les tenants de démonstration locaux incluent itneck, test et company.",
    },
    {
      title: "Connectez-vous en tant qu'administrateur d'organisation",
      body: "Utilisez un compte org_admin tel que admin@{tenant}.test. Le personnel plateforme (admin@hrneck.test) utilise MSP → Ouvrir l'administration du tenant, qui entre dans un vrai contexte de tenant personnel avant le chargement de /org.",
      href: "/login",
    },
    {
      title: "Parcourez la barre latérale",
      body: "Tableau de bord, Formation, Checklists, Ticketing, Employés, Départements, Groupes, Utilisateurs, Rôles, Rapports, Annonces et Paramètres correspondent 1:1 aux capacités du tenant.",
      href: "/org",
    },
    {
      title: "Suivez le parcours de démarrage",
      body: "Importez les employés avec l'assistant de mapping CSV → vérifiez SMTP → connectez les packs/checklists d'onboarding → assignez une campagne de formation → ouvrez Rapports. Chaque étape dispose d'un guide dédié.",
    },
    {
      title: "Invitez des opérateurs avec des rôles",
      body: "Créez des rôles personnalisés avec le catalogue de permissions avant de confier le travail aux techniciens ou formateurs.",
      href: "/org/roles",
    },
  ],
  diagram: {
    title: "Parcours de la première semaine de l'opérateur",
    nodes: [
      { id: "login", label: "Se connecter" },
      { id: "targets", label: "Importer les employés" },
      { id: "smtp", label: "Vérifier SMTP" },
      { id: "campaign", label: "Lancer la campagne" },
      { id: "report", label: "Consulter les rapports" },
    ],
    edges: [
      { from: "login", to: "targets" },
      { from: "targets", to: "smtp" },
      { from: "smtp", to: "campaign" },
      { from: "campaign", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Checklist des premiers pas",
    stats: [
      { label: "Employés", value: "0 → 186" },
      { label: "SMTP", value: "Connecté" },
      { label: "Campagnes", value: "Prêt" },
    ],
    highlight: {
      title: "Configuration de la semaine 1",
      caption:
        "3 tâches de configuration sur 4 terminées · lancez la campagne ensuite",
      progress: 75,
    },
    rows: [
      {
        title: "Importer les employés Finance + Ops",
        meta: "Terminé · CSV",
      },
      {
        title: "Confirmer SMTP mail.hrneck.com",
        meta: "Terminé · Intégrations",
      },
      {
        title: "Créer Sensibilisation sécurité Q4",
        meta: "Suivant · Campagnes",
      },
    ],
    annotations: [
      {
        label: "Barre latérale",
        note: "Les guides restent visibles même avant la connexion.",
      },
      {
        label: "Ouvrir dans l'app",
        note: "Les liens profonds mènent à la route org en direct une fois authentifié.",
      },
    ],
  },
  related: ["auth", "targets-groups", "settings", "training", "msp"],
};
