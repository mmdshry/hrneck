import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Usuarios y roles",
  summary:
    "Invite a operadores y alumnos de la organización, cree roles personalizados y mapee el catálogo de permisos—incluidos los presets de ticketing.",
  keywords: [
    "usuarios",
    "roles",
    "rbac",
    "permisos",
    "sd_admin",
    "learner",
    "acceso",
  ],
  openInAppHref: "/org/users",
  overview:
    "Los usuarios de acceso de la org incluyen operadores (org_admin y roles personalizados) y empleados. Cada Empleado (Target) se empareja con un User que normalmente tiene el rol learner para poder iniciar sesión en /learn y el portal de servicio. Use Usuarios para invitar personas y Roles para componer permisos en formación, checklists, ticketing, informes, ajustes y anuncios. Ticketing incluye roles preset como sd_admin, sd_technician, sd_user y kb_admin. Los roles de personal de plataforma (platform_super_admin / platform_agent) son pares entre sí—no una jerarquía por encima de los roles de la org—y entran en un tenant vía contexto MSP.",
  example: {
    title: "Rol de técnico de service desk",
    narrative:
      "El administrador crea el rol «SD Technician» con org.ticketing.tickets y permisos de mesa relacionados, invita a lee@acme.test y verifica que Lee puede hacer triage de incidentes pero no cambiar el branding en Ajustes. Por separado, una nueva incorporación en Empleados obtiene un User learner emparejado y puede abrir /learn sin aparecer como operador de la org.",
  },
  steps: [
    {
      title: "Revise los usuarios existentes",
      body: "Confirme quién ya tiene org_admin, learner o roles personalizados en el tenant.",
      href: "/org/users",
    },
    {
      title: "Abra Roles",
      body: "Inspeccione el catálogo de permisos y clone o cree un rol que coincida con el puesto.",
      href: "/org/roles",
    },
    {
      title: "Asigne presets de ticketing con cuidado",
      body: "Use los presets sd_* / kb_admin cuando la persona solo necesita alcance de service desk.",
    },
    {
      title: "Invite al operador o confíe en el emparejamiento de empleado",
      body: "Cree un operador en Usuarios con el rol adecuado, o añada un Empleado para que ProvisionEmployeePair cree el User/login learner emparejado.",
    },
    {
      title: "Verifique el mínimo privilegio",
      body: "Inicie sesión como ese usuario (o revise permisos) para asegurar que Ajustes y Usuarios siguen bloqueados para no administradores. El MFA sigue disponible para todo usuario de la org autenticado.",
    },
  ],
  diagram: {
    title: "Modelo de acceso",
    nodes: [
      { id: "user", label: "User (acceso)" },
      { id: "role", label: "Rol" },
      { id: "perms", label: "Permisos" },
      { id: "modules", label: "Módulos de la org" },
      { id: "target", label: "Target / empleado" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "learner emparejado" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Roles",
    stats: [
      { label: "Usuarios", value: "9" },
      { label: "Roles personalizados", value: "4" },
      { label: "Presets", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Tickets + mesas · sin settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner · Target emparejado" },
    ],
    annotations: [
      {
        label: "Catálogo",
        note: "Los permisos se aplican en /api/v1/org/*.",
      },
      {
        label: "Empleados",
        note: "Los empleados son usuarios de acceso vía emparejamiento Target↔User (learner).",
      },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
