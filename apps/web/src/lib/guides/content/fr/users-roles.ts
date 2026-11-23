import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Utilisateurs et rôles",
  summary:
    "Invitez des opérateurs et apprenants org, créez des rôles personnalisés et mappez le catalogue de permissions—y compris les presets ticketing.",
  keywords: [
    "utilisateurs",
    "rôles",
    "rbac",
    "permissions",
    "sd_admin",
    "learner",
    "accès",
  ],
  openInAppHref: "/org/users",
  overview:
    "Les utilisateurs de connexion org incluent les opérateurs (org_admin et rôles personnalisés) et les employés. Chaque Employé (Target) est apparié à un User qui détient généralement le rôle learner pour se connecter à /learn et au portail de service. Utilisez Utilisateurs pour inviter des personnes et Rôles pour composer les permissions sur formation, checklists, ticketing, rapports, paramètres et annonces. Ticketing fournit des rôles preset tels que sd_admin, sd_technician, sd_user et kb_admin. Les rôles du personnel plateforme (platform_super_admin / platform_agent) sont pairs entre eux—pas une hiérarchie au-dessus des rôles org—et entrent dans un tenant via le contexte MSP.",
  example: {
    title: "Rôle de technicien service desk",
    narrative:
      "L'admin crée le rôle « SD Technician » avec org.ticketing.tickets et les permissions de bureau associées, invite lee@acme.test et vérifie que Lee peut triager les incidents mais ne peut pas modifier le branding sous Paramètres. Séparément, une nouvelle embauche sur Employés obtient un User learner apparié et peut ouvrir /learn sans apparaître comme opérateur org.",
  },
  steps: [
    {
      title: "Examinez les utilisateurs existants",
      body: "Confirmez qui a déjà org_admin, learner ou des rôles personnalisés dans le tenant.",
      href: "/org/users",
    },
    {
      title: "Ouvrez Rôles",
      body: "Inspectez le catalogue de permissions et clonez ou créez un rôle adapté au poste.",
      href: "/org/roles",
    },
    {
      title: "Assignez les presets ticketing avec soin",
      body: "Utilisez les presets sd_* / kb_admin lorsque la personne n'a besoin que du périmètre service desk.",
    },
    {
      title: "Invitez l'opérateur ou comptez sur l'appariement employé",
      body: "Créez un opérateur sur Utilisateurs avec le bon rôle, ou ajoutez un Employé pour que ProvisionEmployeePair crée le User/login learner apparié.",
    },
    {
      title: "Vérifiez le moindre privilège",
      body: "Connectez-vous en tant que cet utilisateur (ou examinez les permissions) pour vous assurer que Paramètres et Utilisateurs restent verrouillés pour les non-admins. Le MFA reste disponible pour tout utilisateur org connecté.",
    },
  ],
  diagram: {
    title: "Modèle d'accès",
    nodes: [
      { id: "user", label: "User (connexion)" },
      { id: "role", label: "Rôle" },
      { id: "perms", label: "Permissions" },
      { id: "modules", label: "Modules org" },
      { id: "target", label: "Target / employé" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "learner apparié" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Rôles",
    stats: [
      { label: "Utilisateurs", value: "9" },
      { label: "Rôles personnalisés", value: "4" },
      { label: "Presets", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Tickets + bureaux · pas de settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner · Target apparié" },
    ],
    annotations: [
      {
        label: "Catalogue",
        note: "Les permissions sont appliquées sur /api/v1/org/*.",
      },
      {
        label: "Employés",
        note: "Les employés sont des utilisateurs de connexion via l'appariement Target↔User (learner).",
      },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
