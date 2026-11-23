import type { GuideModule } from "@/lib/guides/types";

export const dashboardGuide: GuideModule = {
  slug: "dashboard",
  title: "Panel de la organización",
  summary:
    "Consulte métricas en vivo de los módulos que permiten sus permisos y acceda a los flujos que requieren atención.",
  keywords: [
    "panel",
    "métricas",
    "en vivo",
    "resumen",
    "permisos",
    "postura",
  ],
  openInAppHref: "/org",
  overview:
    "El panel de la organización muestra widgets de métricas filtrados por permisos—finalización y riesgo de formación, checklists abiertos, presión de ticketing y recuentos de personas—en lugar de un menú fijo de accesos directos. Los operadores con org.reports.view obtienen un resumen en vivo del canal de informes detallados; el resto ve recuentos por módulo cuando están disponibles.",
  example: {
    title: "Revisión de postura del lunes",
    narrative:
      "Antes del standup, Jordan abre /org y ve la finalización de formación al 86 %, checklists abiertos y presión de SLA en el widget de ticketing. Entra directamente en Formación y luego en Ticketing, sin buscar una cuadrícula genérica de accesos.",
  },
  steps: [
    {
      title: "Abra el panel",
      body: "Vaya a Organización → Panel. Los widgets reflejan solo el tenant con el que ha iniciado sesión y sus permisos.",
      href: "/org",
    },
    {
      title: "Lea los widgets que puede ver",
      body: "Formación (informes o gestión de formación), Checklists, Ticketing y Personas aparecen solo cuando tiene el permiso correspondiente.",
    },
    {
      title: "Entre directamente en el trabajo",
      body: "Cada widget enlaza a su módulo para que pueda actuar sin usar el antiguo menú de accesos.",
    },
    {
      title: "Confíe en la actualización en vivo cuando haya informes",
      body: "Con org.reports.view, las capturas de reports-detailed de Reverb mantienen las tarjetas en vivo. Si el socket cae, la interfaz muestra Sincronización en vivo no disponible y se reconecta automáticamente—no hay botón Actualizar.",
    },
  ],
  diagram: {
    title: "Flujo de información del panel",
    nodes: [
      { id: "perms", label: "Permisos" },
      { id: "api", label: "APIs de la org" },
      { id: "ws", label: "Canal en vivo" },
      { id: "cards", label: "Widgets de métricas" },
    ],
    edges: [
      { from: "perms", to: "cards", label: "filtro" },
      { from: "api", to: "cards", label: "instantánea" },
      { from: "ws", to: "cards", label: "actualizado" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Panel de la org",
    stats: [
      { label: "Finalización", value: "86%" },
      { label: "Checklists abiertos", value: "3" },
      { label: "Tickets abiertos", value: "14" },
    ],
    highlight: {
      title: "Postura de formación · Esta semana",
      caption:
        "412 asignados · Finanzas aún se pone al día · Destinatarios sin acción marcados",
      progress: 86,
    },
    rows: [
      { title: "Formación", meta: "86 % completado · 2 campañas en curso" },
      { title: "Checklists", meta: "3 instancias abiertas" },
      { title: "Ticketing", meta: "14 abiertos · vigilancia SLA" },
    ],
    annotations: [
      {
        label: "Filtro de permisos",
        note: "Los widgets se ocultan cuando falta el permiso org.* correspondiente.",
      },
      {
        label: "Enlaces profundos",
        note: "Un clic a Formación, Checklists, Ticketing o Usuarios.",
      },
    ],
  },
  related: ["training", "reporting", "targets-groups"],
};
