import type { GuideModule } from "@/lib/guides/types";

export const servicePortalGuide: GuideModule = {
  slug: "service-portal",
  title: "Portal de servicio",
  summary:
    "Envíe y siga sus propios tickets, añada notas y consulte artículos publicados de la base de conocimiento desde /portal.",
  keywords: [
    "portal",
    "tickets",
    "kb",
    "base de conocimiento",
    "service desk",
    "usuario final",
    "enviar",
  ],
  openInAppHref: "/portal/tickets",
  overview:
    "El portal de servicio es la cara de ticketing orientada al empleado. El acceso del tenant usa org.ticketing.portal—el rol learner semilla incluye solo ese permiso—así que los Users de empleados emparejados pueden abrir /portal para listar y enviar tickets, añadir notas en sus propias solicitudes y consultar artículos KB publicados. Los técnicos siguen trabajando la cola en /org/ticketing. La cabecera del portal siempre enlaza Mis tickets, Base de conocimiento y Learn; Técnico aparece solo cuando el usuario autenticado también tiene org.ticketing.tickets u org.ticketing.admin (no para cuentas solo learner).",
  example: {
    title: "El empleado informa una factura sospechosa",
    narrative:
      "Alex inicia sesión con una cuenta learner, abre /portal/tickets, envía «PDF de factura sospechosa» con una descripción breve, más tarde añade una nota con una captura y luego encuentra el artículo KB publicado «Cómo informar phishing» en /portal/kb después de que el service desk convierte INC-1842.",
  },
  steps: [
    {
      title: "Inicie sesión",
      body: "Use su cuenta del tenant. Las APIs del portal requieren org.ticketing.portal; el rol learner semilla concede exactamente eso (sin acceso a la cola de la org).",
      href: "/login",
    },
    {
      title: "Abra Mis tickets",
      body: "/portal redirige a tickets. Liste sus solicitudes y abra una para ver el detalle.",
      href: "/portal/tickets",
    },
    {
      title: "Envíe una solicitud",
      body: "Cree un ticket nuevo con título y descripción claros. Llega a la cola de la mesa de la org para los técnicos.",
    },
    {
      title: "Añada notas en su ticket",
      body: "Haga seguimiento con más detalle desde la página de detalle del ticket sin necesitar la UI de ticketing de la org.",
    },
    {
      title: "Consulte la KB publicada",
      body: "Abra /portal/kb para artículos que el service desk ha publicado. Los borradores permanecen invisibles aquí.",
      href: "/portal/kb",
    },
  ],
  sections: [
    {
      title: "Portal frente a cola de la org",
      steps: [
        {
          title: "Los empleados permanecen en /portal",
          body: "No espere administración de mesas, fusión masiva, editores SLA ni lectores de correo en el portal—esas son herramientas de operador.",
        },
        {
          title: "Los técnicos usan /org/ticketing",
          body: "Triage, SLA, ingesta IMAP y conversión ticket→KB viven en la app de la org. Consulte la guía de ticketing ITIL.",
          href: "/org/ticketing",
        },
        {
          title: "Accesos de la cabecera",
          body: "Use Learn para asignaciones de formación. Técnico solo aparece cuando tiene org.ticketing.tickets u org.ticketing.admin—los usuarios solo learner permanecen en /portal.",
        },
      ],
    },
  ],
  diagram: {
    title: "Flujo de solicitud del portal",
    nodes: [
      { id: "user", label: "Usuario del portal" },
      { id: "ticket", label: "Mi ticket" },
      { id: "queue", label: "Cola de la org" },
      { id: "kb", label: "KB publicada" },
    ],
    edges: [
      { from: "user", to: "ticket" },
      { from: "ticket", to: "queue" },
      { from: "queue", to: "kb", label: "convertir" },
      { from: "kb", to: "user" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Portal · Mis tickets",
    stats: [
      { label: "Abiertos", value: "1" },
      { label: "Resueltos", value: "3" },
      { label: "KB", value: "Publicada" },
    ],
    highlight: {
      title: "PDF de factura sospechosa",
      caption: "En espera del service desk · nota añadida 10:21",
      progress: 35,
    },
    rows: [
      { title: "Mi solicitud · PDF de factura sospechosa", meta: "Abierta" },
      { title: "KB · Cómo informar phishing", meta: "Publicada" },
      { title: "Cabecera · Learn", meta: "Asignaciones de formación" },
    ],
    annotations: [
      {
        label: "Alcance",
        note: "En el portal solo ve sus propios tickets.",
      },
      {
        label: "KB",
        note: "Solo los artículos publicados aparecen en /portal/kb.",
      },
    ],
  },
  related: ["ticketing", "learner-portal", "auth"],
};
