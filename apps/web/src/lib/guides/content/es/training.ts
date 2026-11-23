import type { GuideModule } from "@/lib/guides/types";

export const trainingGuide: GuideModule = {
  slug: "training",
  title: "Formación de concienciación en seguridad",
  summary:
    "Cree cursos y cuestionarios, asigne contenido, ejecute campañas de recordatorio y exporte el progreso por lección para las partes interesadas.",
  keywords: [
    "formación",
    "lms",
    "campaña",
    "curso",
    "cuestionario",
    "asignar",
    "recordatorio",
    "tiempo de visionado",
    "ensayo",
    "exportación pdf",
    "cancelar",
    "archivar",
  ],
  openInAppHref: "/org/training",
  overview:
    "Cursos alberga la biblioteca (lecciones de artículo, vídeo y PDF más cuestionarios). Formación asigna uno o más cursos a empleados y/o grupos, ejecuta campañas que encolan un recordatorio por correo de un solo envío por destinatario al lanzar (vía SMTP y perfiles de envío), y revisa el progreso por lección con exportación CSV o PDF. Los alumnos consumen el contenido asignado en el portal del alumno en /learn—no en la cola de la org. Existe una lista de muestra secundaria en /org/campaigns para demos rápidas; el flujo del operador vive en Formación → Campañas.",
  example: {
    title: "Campaña de concienciación Q4 de Finanzas de Acme",
    narrative:
      "Ops crea Phishing Essentials con tres lecciones y un cuestionario obligatorio (80 % de aprobado, límite de 15 minutos, un ensayo). Desde Formación asignan el curso al grupo Finanzas (186 personas), lanzan Concienciación de seguridad Q4 (un correo de recordatorio encolado por destinatario), ven la finalización subir del 12 % al 86 % y exportan el PDF del informe de visionado para la dirección.",
  },
  steps: [
    {
      title: "Construya la biblioteca de cursos",
      body: "Cree cursos y lecciones en Cursos antes de asignar nada. Añada cuestionarios con nota de aprobado, marca de obligatorio, límite de tiempo, opción múltiple y preguntas de ensayo opcionales.",
      href: "/org/courses",
    },
    {
      title: "Asigne contenido",
      body: "En Formación, seleccione uno o más cursos y asígnelos a empleados y/o grupos. Los alumnos ven las inscripciones en /learn tras la asignación.",
      href: "/org/training",
    },
    {
      title: "Cree una campaña",
      body: "Nombre la campaña, elija contenido, seleccione group_ids y/o targets y lance. El lanzamiento encola un trabajo de recordatorio por destinatario—no hay cadencia semanal de recordatorios. Confirme primero SMTP y el perfil de envío.",
      href: "/org/training/campaigns",
    },
    {
      title: "Supervise y exporte",
      body: "Siga la inscripción, el estado de la lección, el tiempo de visionado y las marcas de tiempo. Descargue CSV o PDF del informe de visionado; luego cancele (detiene trabajos de recordatorio pendientes) o archive campañas cuando termine la oleada.",
    },
  ],
  sections: [
    {
      title: "Biblioteca de cursos",
      body: "Todo lo que los alumnos abrirán después se crea aquí. Mantenga títulos claros y cuestionarios alineados con las lecciones que siguen.",
      steps: [
        {
          title: "Cree un curso",
          body: "Defina título, descripción y duración esperada. Los cursos son la unidad que asigna y usa en campañas.",
          href: "/org/courses",
        },
        {
          title: "Añada lecciones",
          body: "Use lecciones de artículo/texto, vídeo (URL de YouTube/Vimeo o archivo subido), audio o documento (PDF, TXT, MD, DOC, DOCX) de hasta 100 MB. Ordene las lecciones en la secuencia que deben completar los alumnos.",
        },
        {
          title: "Configure cuestionarios",
          body: "Añada uno o más cuestionarios por curso. Defina la nota de aprobado, márquelos como obligatorios u opcionales, añada opcionalmente un temporizador, mezcle ítems de opción múltiple e incluya preguntas de ensayo sin puntuación cuando necesite respuestas de texto libre.",
        },
        {
          title: "Suba y reproduzca medios",
          body: "Use Vista previa en Cursos para confirmar que vídeo/audio se reproducen y los documentos se abren antes de asignar a una audiencia grande, de modo que el primer recordatorio no llegue a contenido roto.",
        },
      ],
    },
    {
      title: "Asignar y seguir",
      body: "La asignación crea inscripciones. El seguimiento es por alumno y por lección—no solo totales del embudo de la campaña.",
      steps: [
        {
          title: "Asigne uno o más cursos",
          body: "Desde Formación, elija cursos y destine empleados y/o grupos. Puede asignar un ítem completo de la biblioteca; las campañas siguen siendo la vía para oleadas temporizadas con recordatorios.",
          href: "/org/training",
        },
        {
          title: "Abra el informe de visionado",
          body: "Inspeccione el estado de la lección por alumno, tiempo de visionado y marcas opened-at y completed-at para localizar a personas atrasadas por nombre.",
        },
        {
          title: "Exporte CSV o PDF",
          body: "Descargue el informe de visionado como CSV para hojas de cálculo o PDF para packs de interesados. Combínelo con Informes para calendarios a escala de la org.",
        },
        {
          title: "Envíe a los alumnos a /learn",
          body: "Los operadores permanecen en /org/training. Los alumnos abren el portal del alumno para leer, ver, marcar como completado y hacer cuestionarios. Consulte la guía Portal del alumno.",
          href: "/learn",
        },
      ],
    },
    {
      title: "Campañas y recordatorios",
      body: "Las campañas agrupan contenido + audiencia + un recordatorio de un solo envío al lanzar. Los estados incluyen draft, scheduled, running, completed, cancelled y archived.",
      steps: [
        {
          title: "Lance desde Formación → Campañas",
          body: "Nombre la oleada, adjunte contenido del curso, seleccione grupos/empleados y lance. Cada destinatario recibe un trabajo de recordatorio—sin cadencia semanal recurrente.",
          href: "/org/training/campaigns",
        },
        {
          title: "Confirme la ruta de entrega",
          body: "El correo de recordatorio usa el SMTP de la org y el perfil de envío activo. Verifique Integraciones y Perfiles de envío antes del primer envío.",
          href: "/org/settings/integrations",
        },
        {
          title: "Lea el embudo de la campaña",
          body: "Observe inscripciones, en curso, completados, % abiertos y % completados en la tarjeta de la campaña a medida que los alumnos terminan las lecciones.",
        },
        {
          title: "Cancele o archive",
          body: "Cancele una oleada en borrador, programada o en curso para que los trabajos de recordatorio pendientes no se ejecuten; archive (PATCH o DELETE para running/completed) para mantener la lista limpia sin borrar el historial.",
        },
        {
          title: "Conozca la página de campañas de muestra",
          body: "/org/campaigns es una lista secundaria de «lanzar campaña de muestra» (org.campaigns.manage). No está en la barra lateral; prefiera Formación → Campañas para oleadas de producción.",
          href: "/org/campaigns",
        },
      ],
    },
  ],
  diagram: {
    title: "Ciclo de vida de la campaña",
    nodes: [
      { id: "library", label: "Cursos" },
      { id: "audience", label: "Targets / grupos" },
      { id: "campaign", label: "Campaña" },
      { id: "mail", label: "Recordatorios" },
      { id: "learn", label: "Portal del alumno" },
      { id: "metrics", label: "Progreso + exportación" },
    ],
    edges: [
      { from: "library", to: "campaign" },
      { from: "audience", to: "campaign" },
      { from: "campaign", to: "mail" },
      { from: "campaign", to: "learn" },
      { from: "learn", to: "metrics" },
      { from: "mail", to: "metrics" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Campañas de formación",
    stats: [
      { label: "Finalización", value: "86%" },
      { label: "Asignados", value: "186" },
      { label: "Recordatorios", value: "Un solo envío" },
    ],
    highlight: {
      title: "Concienciación de seguridad Q4",
      caption: "Grupo Finanzas · Phishing Essentials · 38 atrasados",
      progress: 86,
    },
    rows: [
      { title: "Lección 1 · Detectar el señuelo", meta: "92 % completo · 4 m de visionado medio" },
      { title: "Cuestionario · Informar phishing", meta: "81 % aprobado · obligatorio · 15 m" },
      { title: "Exportar informe de visionado", meta: "CSV + PDF listos" },
    ],
    annotations: [
      {
        label: "Tarjeta de campaña",
        note: "Las métricas del embudo se actualizan a medida que los alumnos terminan las lecciones.",
      },
      {
        label: "Recordatorios",
        note: "Un trabajo por destinatario al lanzar; cancelar detiene los envíos pendientes.",
      },
    ],
  },
  related: ["learner-portal", "targets-groups", "settings", "reporting"],
};
