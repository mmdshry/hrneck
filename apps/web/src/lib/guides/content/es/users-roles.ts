import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Empleados y roles",
  summary:
    "Gestiona empleados y sus roles de acceso, crea roles personalizados y mapea el catálogo de permisos, incluidos los presets de ticketing.",
  keywords: ["usuarios", "empleados", "roles", "rbac", "permisos", "sd_admin", "learner", "acceso"],
  openInAppHref: "/org/targets",
  overview:
    "Las cuentas de acceso y los empleados forman una sola lista en Empleados. Cada empleado tiene un acceso, y su rol (por ejemplo learner, org_admin o un rol personalizado) se muestra en su fila, donde puedes cambiarlo. Un empleado nuevo recibe por defecto el rol learner para que pueda abrir su panel en /portal. Usa Roles para componer permisos sobre formación, checklists, ticketing, informes, ajustes y anuncios. Ticketing incluye roles preset como sd_admin, sd_technician, sd_user y kb_admin. Los roles del personal de la plataforma (platform_super_admin / platform_agent) son pares entre sí, no una jerarquía por encima de los roles de la org, y entran a un tenant mediante el contexto MSP.",
  example: {
    title: "Rol de técnico de service desk",
    narrative:
      "El administrador crea el rol «SD Technician» con org.ticketing.tickets y los permisos de escritorio relacionados, añade a lee@acme.test como empleado con ese rol y comprueba que Lee puede clasificar incidentes pero no cambiar la marca en Ajustes. Una nueva incorporación con el rol learner por defecto abre /portal y ve sus cursos sin ningún acceso de operador.",
  },
  steps: [
    {
      title: "Revisa los empleados y sus roles",
      body: "En Empleados, la columna Rol muestra el rol de cada acceso. Confirma quién ya tiene org_admin, learner o roles personalizados en el tenant.",
      href: "/org/targets",
    },
    {
      title: "Abre Roles",
      body: "Revisa el catálogo de permisos y clona o crea un rol que encaje con el puesto.",
      href: "/org/roles",
    },
    {
      title: "Asigna los presets de ticketing con cuidado",
      body: "Usa los presets sd_* / kb_admin cuando la persona solo necesite el alcance del service desk.",
    },
    {
      title: "Añade al empleado con el rol adecuado",
      body: "Añade un empleado en Empleados y elige su rol (el valor por defecto es learner). El acceso se crea e invita automáticamente; para operadores, elige un rol con solo los permisos que necesitan.",
    },
    {
      title: "Verifica el mínimo privilegio",
      body: "Inicia sesión como ese usuario (o revisa los permisos) para asegurarte de que Ajustes y Empleados siguen bloqueados para los no administradores. La MFA sigue disponible para cada usuario de la org que inicia sesión.",
    },
  ],
  diagram: {
    title: "Modelo de acceso",
    nodes: [
      { id: "user", label: "Acceso (login)" },
      { id: "role", label: "Rol" },
      { id: "perms", label: "Permisos" },
      { id: "modules", label: "Módulos de la org" },
      { id: "target", label: "Empleado" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "acceso vinculado" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Empleados",
    stats: [
      { label: "Empleados", value: "9" },
      { label: "Roles personalizados", value: "4" },
      { label: "Presets", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Tickets + escritorios · sin settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner" },
    ],
    annotations: [
      { label: "Catálogo", note: "Los permisos se aplican en /api/v1/org/*." },
      { label: "Empleados", note: "Cada empleado tiene un acceso; su rol se define en la lista de Empleados." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
