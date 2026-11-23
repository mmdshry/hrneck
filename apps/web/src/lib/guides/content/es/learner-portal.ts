import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Portal del alumno",
  summary:
    "Complete cursos asignados, vea lecciones con tiempo de visionado registrado, haga cuestionarios y siga las notificaciones de formación en /learn.",
  keywords: [
    "alumno",
    "aprender",
    "cuestionario",
    "curso",
    "inscripción",
    "tiempo de visionado",
    "ensayo",
    "portal",
  ],
  openInAppHref: "/learn",
  overview:
    "El portal del alumno es donde las personas inscritas consumen contenido de concienciación en seguridad. Los operadores asignan cursos desde /org/training; los alumnos inician sesión en el host del tenant y abren /learn para ver asignaciones, leer artículos, ver vídeo subido o incrustado (se informa el tiempo de visionado), abrir PDF, marcar lecciones como completadas y hacer cuestionarios con notas de aprobado, flags opcionales, temporizadores y respuestas de ensayo. Los checklists de RR. HH. nunca aparecen aquí. La campana de notificaciones en la cabecera del alumno muestra eventos training_assigned con enlaces profundos de vuelta a /learn.",
  example: {
    title: "La analista de Finanzas termina Phishing Essentials",
    narrative:
      "Maya abre /learn, ve Concienciación de seguridad Q4 al 40 %, ve la Lección 2 (4 minutos registrados), la marca como completada y luego hace el cuestionario obligatorio con temporizador de 15 minutos. Aprueba con un 88 %, deja un ensayo sobre «cómo informaría un señuelo» y el informe de visionado de la org actualiza su fila antes del siguiente recordatorio.",
  },
  steps: [
    {
      title: "Inicie sesión en el host del tenant",
      body: "Use su cuenta de la org en {slug}.hrneck.test. Puede requerirse MFA. Los alumnos no usan MSP ni la administración Filament.",
      href: "/login",
    },
    {
      title: "Abra /learn",
      body: "Revise los cursos asignados con estado y progreso. Solo aparecen las inscripciones creadas por asignaciones o campañas de Formación.",
      href: "/learn",
    },
    {
      title: "Complete las lecciones",
      body: "Lea artículos, vea vídeo (URL o subida), abra PDF y marque cada lección como completada al terminarla.",
    },
    {
      title: "Haga los cuestionarios",
      body: "Respete la nota de aprobado, obligatorio u opcional, y cualquier temporizador. Responda opción múltiple y ensayos sin puntuación, luego envíe.",
    },
    {
      title: "Observe la campana de notificaciones",
      body: "Las nuevas asignaciones de formación aparecen en la campana de la cabecera del alumno con un enlace profundo al curso.",
    },
  ],
  sections: [
    {
      title: "Lo que los alumnos nunca ven",
      steps: [
        {
          title: "Sin checklists de RR. HH.",
          body: "Los formularios de onboarding/offboarding son solo de administración en /org/checklists. Los empleados son registros de audiencia; las instancias de checklist las rellenan operadores de RR. HH.",
        },
        {
          title: "Sin barra lateral de administración de la org",
          body: "La autoría de cursos, el lanzamiento de campañas y la exportación del informe de visionado permanecen en /org para usuarios con org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Ruta del alumno",
    nodes: [
      { id: "assign", label: "La org asigna el curso" },
      { id: "learn", label: "Lista /learn" },
      { id: "lesson", label: "Lección" },
      { id: "quiz", label: "Cuestionario" },
      { id: "report", label: "Informe de visionado de la org" },
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
      caption: "Lección 2 de 3 · 4 m vistos · cuestionario desbloqueado a continuación",
      progress: 66,
    },
    rows: [
      { title: "Lección 1 · Detectar el señuelo", meta: "Completada" },
      { title: "Lección 2 · Enlaces seguros", meta: "En curso · vídeo" },
      { title: "Cuestionario · Informar phishing", meta: "Obligatorio · límite 15 m" },
    ],
    annotations: [
      {
        label: "Tiempo de visionado",
        note: "El progreso del vídeo se reporta al informe de visionado de la org.",
      },
      {
        label: "Campana",
        note: "Las notificaciones training_assigned enlazan profundamente a /learn.",
      },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
