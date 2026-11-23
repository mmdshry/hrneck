import type { GuideModule } from "@/lib/guides/types";

export const checklistsGuide: GuideModule = {
  slug: "checklists",
  title: "Checklists de RR. HH.",
  summary:
    "Diseñe plantillas solo para administradores con ítems condicionales, versione con seguridad, agrupe packs con autoasignación y audite cada cambio de respuesta.",
  keywords: [
    "checklist",
    "onboarding",
    "offboarding",
    "plantilla",
    "instancia",
    "pack",
    "welcome pack",
    "autoasignación",
    "auditoría",
    "rrhh",
    "visible_when",
    "requires",
    "versión",
  ],
  openInAppHref: "/org/checklists",
  overview:
    "Los checklists son flujos internos de RR. HH.—no contenido para alumnos y nunca se muestran en /learn. Los administradores diseñan plantillas flexibles, copian las cinco plantillas de sistema de RR. HH., agrupan packs (por ejemplo un Welcome Pack), conectan instancias a empleados y las rellenan como operadores. Al guardar elige si un nuevo esquema de plantilla se aplica a instancias abiertas o solo a las nuevas. Los packs publicados pueden autoasignarse al crear un empleado nuevo. Cada cambio de respuesta queda en el registro de actividad del tenant.",
  example: {
    title: "Welcome Pack de nueva incorporación",
    narrative:
      "RR. HH. copia las plantillas de sistema Onboarding y Acceso TI, añade un select «¿Necesita portátil?» que revela una casilla de portátil vía visible_when, y una firma del responsable que requiere MFA enrolled. Publican un Welcome Pack con autoasignación. Cuando se añade alex.ng@acme.test, ambas instancias aparecen en el perfil del empleado; los operadores rellenan ítems y la pista de auditoría muestra quién marcó la inscripción MFA.",
  },
  steps: [
    {
      title: "Abra Checklists",
      body: "Explore plantillas personalizadas y de sistema desde el hub de Checklists. Copie una plantilla de sistema antes de asignarla.",
      href: "/org/checklists",
    },
    {
      title: "Edite una plantilla",
      body: "Use el constructor para tipos de ítem, reglas visible_when y dependencias requires. Guarde eligiendo aplicar a abiertas o solo a nuevas.",
    },
    {
      title: "Cree un pack",
      body: "Agrupue plantillas en un Welcome Pack y, opcionalmente, active la autoasignación al crear un empleado.",
      href: "/org/checklists/packs",
    },
    {
      title: "Conecte y rellene",
      body: "Asigne desde Instancias o un perfil de empleado, complete ítems como RR. HH. y revise el historial del registro de actividad.",
      href: "/org/checklists/instances",
    },
  ],
  sections: [
    {
      title: "Constructor de plantillas",
      body: "Las plantillas son definiciones de formulario versionadas. Los empleados nunca las rellenan—solo operadores con org.checklists.manage.",
      steps: [
        {
          title: "Parta de una plantilla de sistema cuando pueda",
          body: "Cinco plantillas semilla cubren Incorporación de empleados, Baja de empleados, Provisionamiento de acceso TI, Traslado interno / cambio de rol y Retorno de permiso. Copie antes de editar para que el original de sistema permanezca intacto.",
          href: "/org/checklists",
        },
        {
          title: "Añada tipos de ítem",
          body: "Tipos admitidos: sección, casilla, texto corto, texto largo, selección única, selección múltiple, fecha, número, archivo, enlace y nota enriquecida.",
        },
        {
          title: "Use visible_when para condicionales",
          body: "Oculte o muestre ítems según respuestas anteriores (por ejemplo, mostrar «Etiqueta de activo del portátil» solo cuando ¿Necesita portátil? = sí).",
        },
        {
          title: "Use requires para dependencias",
          body: "Bloquee un ítem hasta que otro esté completo (por ejemplo, la firma del responsable requiere MFA enrolled).",
        },
        {
          title: "Abra el constructor",
          body: "Edite el esquema en /org/checklists/[id]. Mantenga las secciones cortas para que los operadores puedan escanear instancias abiertas con rapidez.",
        },
      ],
    },
    {
      title: "Versionado al guardar",
      body: "Guardar crea una nueva versión de la plantilla. Usted decide cómo se ve afectado el trabajo abierto.",
      steps: [
        {
          title: "Elija aplicar a instancias abiertas",
          body: "Empuje el nuevo esquema a instancias que siguen abiertas cuando el cambio de proceso debe aplicarse de inmediato.",
        },
        {
          title: "O elija solo nuevas",
          body: "Deje las instancias abiertas en el esquema anterior y aplique la nueva versión solo a asignaciones futuras—más seguro a mitad de oleada.",
        },
      ],
    },
    {
      title: "Packs y autoasignación",
      body: "Los packs agrupan varias plantillas para una sola incorporación o evento del ciclo de vida.",
      steps: [
        {
          title: "Cree y publique un pack",
          body: "Añada plantillas, nombre el pack (Welcome Pack es el patrón habitual) y publíquelo cuando esté listo.",
          href: "/org/checklists/packs",
        },
        {
          title: "Active la autoasignación en la contratación",
          body: "Cuando está activada, crear un empleado nuevo adjunta automáticamente instancias del pack. Confírmelo en el perfil del empleado tras la importación CSV o el alta manual.",
        },
        {
          title: "Semilla del Welcome Pack",
          body: "Los tenants de demostración pueden incluir ya un Welcome Pack que agrupa onboarding más acceso TI—clone en lugar de reconstruir.",
        },
      ],
    },
    {
      title: "Instancias y auditoría",
      body: "Una instancia es una versión de plantilla vinculada a un empleado.",
      steps: [
        {
          title: "Asigne desde Instancias o el perfil del empleado",
          body: "Conecte una plantilla o pack desde /org/checklists/instances o desde /org/targets/[id]. El progreso se muestra en ambas superficies.",
          href: "/org/checklists/instances",
        },
        {
          title: "Rellene como RR. HH.",
          body: "Complete casillas, textos, selecciones, fechas, números, archivos y enlaces. Las respuestas de archivo se suben en la página de detalle de la instancia.",
        },
        {
          title: "Revise la pista de auditoría",
          body: "Cada cambio de respuesta se registra en el log de actividad del tenant. Use la UI de auditoría de la instancia cuando necesite quién-cambió-qué para cumplimiento.",
        },
      ],
    },
  ],
  diagram: {
    title: "Flujo de plantilla, pack y empleado",
    nodes: [
      { id: "template", label: "Versión de plantilla" },
      { id: "pack", label: "Pack de checklists" },
      { id: "target", label: "Empleado" },
      { id: "instance", label: "Instancia" },
      { id: "audit", label: "Pista de auditoría" },
    ],
    edges: [
      { from: "template", to: "pack" },
      { from: "template", to: "instance" },
      { from: "pack", to: "instance" },
      { from: "target", to: "instance" },
      { from: "instance", to: "audit" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Instancias de checklist",
    stats: [
      { label: "Abiertas", value: "11" },
      { label: "Packs", value: "1 welcome" },
      { label: "Plantillas", value: "5 de sistema" },
    ],
    highlight: {
      title: "Welcome Pack · alex.ng@acme.test",
      caption: "Onboarding + acceso TI conectados",
      progress: 78,
    },
    rows: [
      { title: "MFA enrolled", meta: "Casilla · Hecho" },
      { title: "¿Portátil requerido?", meta: "Visible cuando ¿Necesita portátil? = sí" },
      { title: "Firma del responsable", meta: "Pendiente · requiere MFA" },
    ],
    annotations: [
      {
        label: "Packs",
        note: "El Welcome Pack puede autoasignarse en la contratación.",
      },
      {
        label: "Auditoría",
        note: "Cada cambio de respuesta se registra en la BD del tenant.",
      },
    ],
  },
  related: ["targets-groups", "users-roles", "reporting"],
};
