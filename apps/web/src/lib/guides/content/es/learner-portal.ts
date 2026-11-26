import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Portal del alumno",
  summary:
    "Completa los cursos asignados, mira lecciones con tiempo de reproducción registrado, realiza cuestionarios y sigue las notificaciones de formación desde tu panel de empleado en /portal.",
  keywords: [
    "alumno",
    "learn",
    "panel",
    "cuestionario",
    "curso",
    "inscripción",
    "watch time",
    "essay",
    "portal",
  ],
  openInAppHref: "/portal",
  overview:
    "Los empleados llegan a su panel en /portal tras iniciar sesión. Mis cursos enumera la formación de concienciación en seguridad asignada: los operadores asignan cursos desde /org/training y los alumnos abren cada curso para ver lecciones, leer artículos, ver vídeo subido o incrustado (el tiempo de visualización se reporta), abrir PDF, marcar lecciones como completadas y hacer cuestionarios con puntuaciones de aprobado, indicadores opcionales, cuentas atrás y respuestas de ensayo. El mismo panel enlaza con Mis tickets y la Base de conocimiento. Las listas de RR. HH. nunca aparecen aquí. La campana de notificaciones muestra eventos training_assigned con enlaces directos de vuelta a /portal. El plan puede desactivar Mis cursos; el resto del panel sigue funcionando.",
  example: {
    title: "Analista de finanzas completa Phishing Essentials",
    narrative:
      "Maya abre /portal, ve Concienciación de seguridad Q4 en Mis cursos al 40 %, mira la Lección 2 (4 minutos registrados), la marca como completada y luego hace el cuestionario obligatorio con una cuenta atrás de 15 minutos. Aprueba con un 88 %, deja un ensayo sobre «cómo reportaría un cebo» y el informe de visualización de la organización actualiza su fila antes del siguiente recordatorio.",
  },
  steps: [
    {
      title: "Inicia sesión en el host del tenant",
      body: "Usa tu cuenta de la organización en {slug}.hrneck.test. Puede requerirse MFA. Los alumnos no usan el MSP ni el admin de Filament.",
      href: "/login",
    },
    {
      title: "Abre tu panel en /portal",
      body: "Mis cursos muestra la formación asignada con estado y progreso. Solo aparecen las inscripciones creadas por asignaciones de formación o campañas. Mis tickets y la Base de conocimiento están a un clic.",
      href: "/portal",
    },
    {
      title: "Completa las lecciones",
      body: "Lee artículos, mira vídeo (URL o subida), abre PDF y marca cada lección como completada al terminar.",
    },
    {
      title: "Realiza los cuestionarios",
      body: "Respeta la puntuación de aprobado, lo obligatorio frente a lo opcional y cualquier cuenta atrás. Responde preguntas de opción múltiple y ensayos sin puntuación, y envía.",
    },
    {
      title: "Vigila la campana de notificaciones",
      body: "Las nuevas asignaciones de formación aparecen en la campana con un enlace directo al curso en tu panel.",
    },
  ],
  sections: [
    {
      title: "Lo que los alumnos nunca ven",
      steps: [
        {
          title: "Sin listas de RR. HH.",
          body: "Los formularios de incorporación/baja son solo para administradores en /org/checklists. Los empleados son registros de audiencia; las instancias de checklist las rellenan los operadores de RR. HH.",
        },
        {
          title: "Sin barra lateral de administración de la org",
          body: "La creación de cursos, el lanzamiento de campañas y la exportación del informe de visualización se mantienen en /org para usuarios con org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Recorrido del alumno",
    nodes: [
      { id: "assign", label: "La org asigna el curso" },
      { id: "learn", label: "Mis cursos en /portal" },
      { id: "lesson", label: "Lección" },
      { id: "quiz", label: "Cuestionario" },
      { id: "report", label: "Informe de visualización" },
    ],
    edges: [
      { from: "assign", to: "learn" },
      { from: "learn", to: "lesson" },
      { from: "lesson", to: "quiz" },
      { from: "quiz", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Alumno · Mis cursos",
    stats: [
      { label: "Asignados", value: "2" },
      { label: "En curso", value: "1" },
      { label: "Completados", value: "1" },
    ],
    highlight: {
      title: "Phishing Essentials",
      caption: "Lección 2 de 3 · 4 min vistos · cuestionario desbloqueado después",
      progress: 66,
    },
    rows: [
      { title: "Lección 1 · Detectar el cebo", meta: "Completada" },
      { title: "Lección 2 · Enlaces seguros", meta: "En curso · vídeo" },
      { title: "Cuestionario · Reportar phishing", meta: "Obligatorio · límite 15 min" },
    ],
    annotations: [
      { label: "Tiempo de reproducción", note: "El progreso del vídeo se reporta al informe de visualización." },
      { label: "Campana", note: "Las notificaciones training_assigned enlazan directamente con /portal." },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
