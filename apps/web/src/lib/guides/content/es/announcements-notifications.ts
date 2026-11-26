import type { GuideModule } from "@/lib/guides/types";

export const announcementsNotificationsGuide: GuideModule = {
  slug: "announcements-notifications",
  title: "Anuncios y notificaciones",
  summary:
    "Publique anuncios a toda la organización y comprenda cómo la campana en la app muestra eventos de formación, checklist y tickets.",
  keywords: [
    "anuncios",
    "notificaciones",
    "campana",
    "publicar",
    "alertas",
  ],
  openInAppHref: "/org/announcements",
  overview:
    "Los anuncios permiten a los operadores difundir mensajes con título/cuerpo a la organización. La campana de notificaciones (en el entorno org) agrega eventos de formación asignada, checklist asignado, ticket asignado y anuncios con enlaces profundos—actualizados en vivo por Reverb sin actualización manual.",
  example: {
    title: "Aviso de formación obligatoria",
    narrative:
      "Tras lanzar Concienciación de seguridad Q4, Mira publica «Complete la formación de phishing antes del viernes», y los operadores de Finanzas ven tanto el anuncio como las notificaciones individuales de formación asignada en la campana con enlaces a /portal o al progreso de la campaña.",
  },
  steps: [
    {
      title: "Abra Anuncios",
      body: "Cree un título y un cuerpo claros para el mensaje a toda la organización.",
      href: "/org/announcements",
    },
    {
      title: "Publique",
      body: "Publicar difunde notificaciones en la app a los operadores elegibles.",
    },
    {
      title: "Observe la campana",
      body: "La campana de notificaciones del entorno lista eventos recientes; haga clic para ir al recurso enlazado.",
    },
    {
      title: "Correlacione con eventos de módulo",
      body: "Las asignaciones de formación, checklist y ticket también aparecen en la misma campana sin un anuncio aparte.",
    },
  ],
  diagram: {
    title: "Difusión de notificaciones",
    nodes: [
      { id: "event", label: "Evento de módulo" },
      { id: "announce", label: "Anuncio" },
      { id: "bell", label: "Campana de notificaciones" },
      { id: "deep", label: "Enlace profundo" },
    ],
    edges: [
      { from: "event", to: "bell" },
      { from: "announce", to: "bell" },
      { from: "bell", to: "deep" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Notificaciones",
    stats: [
      { label: "No leídas", value: "4" },
      { label: "Anuncios", value: "1 nuevo" },
      { label: "Formación", value: "2 asignadas" },
    ],
    highlight: {
      title: "Complete la formación de phishing antes del viernes",
      caption: "Publicado 10:02 · visible en toda la org",
      progress: 100,
    },
    rows: [
      {
        title: "Formación asignada · Phishing Essentials",
        meta: "Enlace profundo · /portal",
      },
      {
        title: "Ticket asignado · INC-1842",
        meta: "Enlace profundo · ticketing",
      },
      {
        title: "Checklist asignado · Acceso TI",
        meta: "Enlace profundo · instancias",
      },
    ],
    annotations: [
      {
        label: "Campana",
        note: "Vive en la cabecera del entorno org para usuarios autenticados.",
      },
      {
        label: "Tiempo real",
        note: "El sondeo cubre huecos cuando el WebSocket está offline.",
      },
    ],
  },
  related: ["training", "ticketing", "checklists"],
};
