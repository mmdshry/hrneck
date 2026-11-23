import type { GuideModule } from "@/lib/guides/types";

export const ticketingGuide: GuideModule = {
  slug: "ticketing",
  title: "Ticketing ITIL y KB",
  summary:
    "Gestione mesas de Incident, Problem, Service Request y Change con SLA, operaciones masivas, ingesta de correo, KB, búsqueda e informes CSV/JSON.",
  keywords: [
    "ticketing",
    "incidente",
    "sla",
    "kb",
    "correo",
    "mesa",
    "service desk",
    "masivo",
    "imap",
    "escalado",
    "procedimientos",
    "preferencias",
    "fusionar",
  ],
  openInAppHref: "/org/ticketing",
  overview:
    "El módulo de ticketing cubre lo básico del service desk ITIL para operadores en /org/ticketing: mesas, tickets con notas/tareas/adjuntos, acciones masivas, procedimientos y escalado, políticas SLA, lectores de correo IMAP, artículos KB (incluida la conversión ticket→KB), Buscar todo, preferencias e informes CSV/PDF/JSON. Los empleados envían y siguen el trabajo en el portal de servicio aparte (/portal)—consulte esa guía para los pasos del usuario final. Los permisos se dividen en org.ticketing.tickets, .admin, .kb, .reports y .portal, con roles semilla sd_* / kb_admin.",
  example: {
    title: "Un informe de phishing se convierte en artículo KB",
    narrative:
      "El técnico Lee crea el Incident INC-1842 «PDF de factura sospechosa», añade una nota y una tarea de contención, adjunta la muestra, lo resuelve bajo SLA, convierte el ticket en el artículo KB «Cómo informar phishing», confirma Buscar todo y la KB publicada del portal, y descarga el CSV semanal de ticketing para el standup del service desk.",
  },
  steps: [
    {
      title: "Abra la cola de tickets",
      body: "Filtre por mesa, etapa, asignado y estado archivado desde el hub de ticketing.",
      href: "/org/ticketing",
    },
    {
      title: "Triage de un ticket",
      body: "Capture notas, tareas y adjuntos; mueva etapas; copie o enlace tickets relacionados según sea necesario.",
    },
    {
      title: "Configure mesas, SLA y correo",
      body: "Revise mesas ITIL, procedimientos y SLA en Mesas; conecte lectores IMAP en Correo.",
      href: "/org/ticketing/desks",
    },
    {
      title: "Publique conocimiento y exporte",
      body: "Convierta tickets resueltos a KB, verifique Buscar todo / visibilidad del portal y exporte paquetes CSV/PDF o JSON.",
      href: "/org/ticketing/kb",
    },
  ],
  sections: [
    {
      title: "Triage de la cola",
      body: "Los operadores con org.ticketing.tickets trabajan la cola en vivo. Las mesas incluyen Incident, Problem, Service Request, Change, más un tipo de mesa Knowledge Base.",
      steps: [
        {
          title: "Cree o abra un ticket",
          body: "Defina etapa, estado, prioridad, severidad, categoría y asignado. Los prefijos de número vienen de la configuración de la mesa.",
          href: "/org/ticketing",
        },
        {
          title: "Añada notas, tareas y adjuntos",
          body: "Las notas capturan el trabajo; las tareas admiten un interruptor de completado; los adjuntos se suben y descargan desde la página de detalle del ticket.",
        },
        {
          title: "Copie o enlace tickets",
          body: "Copie un ticket cuando necesite una pista paralela; enlace tickets relacionados para mantener conectados los registros de incidente y problema.",
        },
      ],
    },
    {
      title: "Acciones masivas y preferencias",
      steps: [
        {
          title: "Ejecute acciones masivas",
          body: "Desde la cola, archive, desarhive, marque leído/no leído, detenga notificaciones, elimine, fusione, actualice en grupo, enlace o desbloquee en masa. Use el filtro de archivados para encontrar trabajo masivo cerrado.",
        },
        {
          title: "Configure preferencias",
          body: "Configure el retraso de notificación, el alcance de notificación y la mesa predeterminada para que el trabajo nuevo llegue donde el equipo lo espera.",
        },
      ],
    },
    {
      title: "Mesas, SLA y procedimientos",
      body: "La administración de mesas requiere org.ticketing.admin. Etapas, filas de soporte, procedimientos, SLA y plantillas viven bajo Mesas.",
      steps: [
        {
          title: "Edite mesas y etapas",
          body: "Cree o edite mesas, secuencia de etapas, flags de escalado y etapas terminales. Mantenga estados, prioridades, severidades y categorías como filas de soporte.",
          href: "/org/ticketing/desks",
        },
        {
          title: "Adjunte procedimientos",
          body: "Vincule procedimientos a eventos de creación, entrada en etapa o escalado para que los técnicos reciban playbooks coherentes.",
        },
        {
          title: "Defina políticas SLA",
          body: "Establezca minutos de respuesta y resolución por prioridad. Los trabajos de escalado avanzan de nivel cuando pasa escalation_due_at.",
        },
        {
          title: "Mantenga plantillas de mensaje y nota",
          body: "Reutilice plantillas para respuestas habituales y notas internas para mantener tono y pasos coherentes.",
        },
      ],
    },
    {
      title: "Ingesta de correo",
      steps: [
        {
          title: "Configure un lector de correo",
          body: "Cree, edite o elimine lectores en Correo. Use la ingesta de prueba para demostrar que un mensaje de muestra se convierte en ticket.",
          href: "/org/ticketing/email",
        },
        {
          title: "Confíe en el sondeo IMAP",
          body: "El sondeo crea tickets a partir del correo entrante. Las notificaciones diferidas forman parte del mismo pipeline—ajuste el retraso en preferencias si el equipo se satura.",
        },
      ],
    },
    {
      title: "Base de conocimiento y Buscar todo",
      steps: [
        {
          title: "Redacte y publique artículos",
          body: "Cree, edite, publique/despublique o elimine artículos KB. Los borradores no publicados no llegan al portal del empleado.",
          href: "/org/ticketing/kb",
        },
        {
          title: "Convierta ticket → KB",
          body: "Tras resolver, convierta un ticket en un artículo para que la solución se convierta en conocimiento buscable.",
        },
        {
          title: "Use Buscar todo",
          body: "Busque tickets y KB juntos desde /org/ticketing/search cuando no sepa si la respuesta es un incidente abierto o un artículo publicado.",
          href: "/org/ticketing/search",
        },
      ],
    },
    {
      title: "Informes y paquetes",
      steps: [
        {
          title: "Descargue resúmenes CSV o PDF",
          body: "Las métricas de abiertos, resueltos, incumplimiento de respuesta y de resolución se exportan desde los informes de ticketing.",
          href: "/org/ticketing/reports",
        },
        {
          title: "Importación/exportación JSON (admin)",
          body: "Exporte o importe tickets seleccionados como paquetes JSON al migrar o clonar datos de mesa. Requiere permiso de administración de ticketing.",
        },
      ],
    },
  ],
  diagram: {
    title: "Bucle de ticket a conocimiento",
    nodes: [
      { id: "intake", label: "Correo / portal / agente" },
      { id: "ticket", label: "Ticket" },
      { id: "sla", label: "SLA + escalado" },
      { id: "resolve", label: "Resolver" },
      { id: "kb", label: "Artículo KB" },
      { id: "portal", label: "Portal de servicio" },
    ],
    edges: [
      { from: "intake", to: "ticket" },
      { from: "ticket", to: "sla" },
      { from: "sla", to: "resolve" },
      { from: "resolve", to: "kb" },
      { from: "kb", to: "portal" },
      { from: "portal", to: "intake", label: "nueva solicitud" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Mesa de Incident",
    stats: [
      { label: "En espera", value: "5" },
      { label: "Incumplimientos", value: "0" },
      { label: "Consultas KB", value: "128" },
    ],
    highlight: {
      title: "INC-1842 · PDF de factura sospechosa",
      caption: "Etapa En curso · SLA 4 h restantes",
      progress: 55,
    },
    rows: [
      { title: "Nota · Adjunto en cuarentena", meta: "Lee · 10:14" },
      { title: "Tarea · Restablecer reglas del buzón", meta: "Abierta" },
      { title: "Convertir a KB", meta: "Disponible tras resolver" },
    ],
    annotations: [
      {
        label: "Mesas",
        note: "Las mesas ITIL comparten patrones de etapa pero mantienen colas separadas.",
      },
      {
        label: "Portal",
        note: "Los empleados envían vía /portal/tickets, no la cola de la org.",
      },
    ],
  },
  related: [
    "service-portal",
    "announcements-notifications",
    "reporting",
    "users-roles",
  ],
};
