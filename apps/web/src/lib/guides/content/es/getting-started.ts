import type { GuideModule } from "@/lib/guides/types";

export const gettingStartedGuide: GuideModule = {
  slug: "getting-started",
  title: "Primeros pasos",
  summary:
    "Inicie sesión como administrador de la organización, conozca el entorno del tenant y siga la ruta recomendada de la primera semana.",
  keywords: [
    "incorporación",
    "inicio de sesión",
    "demo",
    "roles",
    "hosts",
    "empezar",
  ],
  openInAppHref: "/org",
  overview:
    "Los espacios de trabajo de tenant de HRNECK se ejecutan en {slug}.hrneck.test (o el alias app.hrneck.test). Los administradores de la organización usan la barra lateral izquierda para gestionar formación, empleados, checklists, ticketing, informes, usuarios y ajustes. Las guías permanecen públicas para que pueda revisar los flujos antes de iniciar sesión.",
  example: {
    title: "Primer acceso de Acme Corp",
    narrative:
      "Sara (org_admin@acme.test) abre acme.hrneck.test, inicia sesión con su cuenta protegida por MFA, llega al panel de la organización y usa Guías para confirmar SMTP y empleados antes de lanzar la campaña de concienciación del Q4.",
  },
  steps: [
    {
      title: "Abra el host de su tenant",
      body: "Use {slug}.hrneck.test para su organización. Los tenants de demostración locales incluyen itneck, test y company.",
    },
    {
      title: "Inicie sesión como administrador de la organización",
      body: "Use una cuenta org_admin como admin@{tenant}.test. El personal de plataforma (admin@hrneck.test) usa MSP → Abrir administración del tenant, que entra en un contexto real de tenant de personal antes de cargar /org.",
      href: "/login",
    },
    {
      title: "Explore la barra lateral",
      body: "Panel, Formación, Checklists, Ticketing, Empleados, Departamentos, Grupos, Usuarios, Roles, Informes, Anuncios y Ajustes se corresponden 1:1 con las capacidades del tenant.",
      href: "/org",
    },
    {
      title: "Siga la ruta de inicio",
      body: "Importe empleados con el asistente de mapeo CSV → verifique SMTP → conecte packs/checklists de onboarding → asigne una campaña de formación → abra Informes. Cada paso tiene una guía dedicada.",
    },
    {
      title: "Invite a operadores con roles",
      body: "Cree roles personalizados con el catálogo de permisos antes de delegar trabajo a técnicos o formadores.",
      href: "/org/roles",
    },
  ],
  diagram: {
    title: "Ruta de la primera semana del operador",
    nodes: [
      { id: "login", label: "Iniciar sesión" },
      { id: "targets", label: "Importar empleados" },
      { id: "smtp", label: "Verificar SMTP" },
      { id: "campaign", label: "Lanzar campaña" },
      { id: "report", label: "Revisar informes" },
    ],
    edges: [
      { from: "login", to: "targets" },
      { from: "targets", to: "smtp" },
      { from: "smtp", to: "campaign" },
      { from: "campaign", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Checklist de primeros pasos",
    stats: [
      { label: "Empleados", value: "0 → 186" },
      { label: "SMTP", value: "Conectado" },
      { label: "Campañas", value: "Listo" },
    ],
    highlight: {
      title: "Configuración de la semana 1",
      caption: "3 de 4 tareas de configuración completadas · lance la campaña a continuación",
      progress: 75,
    },
    rows: [
      { title: "Importar empleados de Finanzas y Operaciones", meta: "Hecho · CSV" },
      { title: "Confirmar SMTP de mail.hrneck.com", meta: "Hecho · Integraciones" },
      { title: "Crear Concienciación de seguridad Q4", meta: "Siguiente · Campañas" },
    ],
    annotations: [
      {
        label: "Barra lateral",
        note: "Las guías siguen visibles incluso antes de iniciar sesión.",
      },
      {
        label: "Abrir en la app",
        note: "Los enlaces profundos saltan a la ruta org en vivo cuando está autenticado.",
      },
    ],
  },
  related: ["auth", "targets-groups", "settings", "training", "msp"],
};
