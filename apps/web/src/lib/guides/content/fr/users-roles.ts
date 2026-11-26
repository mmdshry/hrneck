import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Employés & rôles",
  summary:
    "Gérez les employés et leurs rôles de connexion, créez des rôles personnalisés et cartographiez le catalogue de permissions—y compris les presets de ticketing.",
  keywords: ["utilisateurs", "employés", "rôles", "rbac", "permissions", "sd_admin", "learner", "accès"],
  openInAppHref: "/org/targets",
  overview:
    "Les comptes de connexion et les employés forment une seule liste dans Employés. Chaque employé dispose d'une connexion, et son rôle (par exemple learner, org_admin ou un rôle personnalisé) est affiché sur sa ligne, où vous pouvez le modifier. Un nouvel employé reçoit par défaut le rôle learner afin d'ouvrir son tableau de bord sur /portal. Utilisez Rôles pour composer les permissions sur la formation, les checklists, le ticketing, les rapports, les paramètres et les annonces. Le ticketing fournit des rôles preset tels que sd_admin, sd_technician, sd_user et kb_admin. Les rôles du personnel plateforme (platform_super_admin / platform_agent) sont pairs entre eux—pas une hiérarchie au-dessus des rôles org—et entrent dans un tenant via le contexte MSP.",
  example: {
    title: "Rôle technicien service desk",
    narrative:
      "L'admin crée le rôle « SD Technician » avec org.ticketing.tickets et les permissions de bureau associées, ajoute lee@acme.test comme employé avec ce rôle, et vérifie que Lee peut trier les incidents mais ne peut pas modifier le branding sous Paramètres. Une nouvelle embauche avec le rôle par défaut learner ouvre /portal et voit ses cours sans aucun accès opérateur.",
  },
  steps: [
    {
      title: "Vérifier les employés et leurs rôles",
      body: "Dans Employés, la colonne Rôle indique le rôle de chaque connexion. Vérifiez qui dispose déjà de org_admin, learner ou de rôles personnalisés dans le tenant.",
      href: "/org/targets",
    },
    {
      title: "Ouvrir Rôles",
      body: "Inspectez le catalogue de permissions et clonez ou créez un rôle adapté à la fonction.",
      href: "/org/roles",
    },
    {
      title: "Attribuer les presets de ticketing avec soin",
      body: "Utilisez les presets sd_* / kb_admin lorsque la personne n'a besoin que du périmètre service desk.",
    },
    {
      title: "Ajouter l'employé avec le bon rôle",
      body: "Ajoutez un employé dans Employés et choisissez son rôle (la valeur par défaut est learner). La connexion est créée et invitée automatiquement ; pour les opérateurs, choisissez un rôle avec uniquement les permissions nécessaires.",
    },
    {
      title: "Vérifier le moindre privilège",
      body: "Connectez-vous avec cet utilisateur (ou vérifiez les permissions) pour vous assurer que Paramètres et Employés restent verrouillés pour les non-admins. La MFA reste disponible pour chaque utilisateur org connecté.",
    },
  ],
  diagram: {
    title: "Modèle d'accès",
    nodes: [
      { id: "user", label: "Connexion (login)" },
      { id: "role", label: "Rôle" },
      { id: "perms", label: "Permissions" },
      { id: "modules", label: "Modules org" },
      { id: "target", label: "Employé" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "connexion liée" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Employés",
    stats: [
      { label: "Employés", value: "9" },
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
      { title: "maya@acme.test", meta: "learner" },
    ],
    annotations: [
      { label: "Catalogue", note: "Les permissions sont appliquées sur /api/v1/org/*." },
      { label: "Employés", note: "Chaque employé a une connexion ; son rôle se définit dans la liste Employés." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
