import type { GuideModule } from "@/lib/guides/types";

export const targetsGroupsGuide: GuideModule = {
  slug: "targets-groups",
  title: "Empleados, departamentos y grupos",
  summary:
    "Construya la audiencia de empleados con CRUD, un asistente de mapeo CSV, departamentos, grupos y puntuaciones de riesgo.",
  keywords: [
    "empleados",
    "destinatarios",
    "departamentos",
    "grupos",
    "csv",
    "audiencia",
    "riesgo",
  ],
  openInAppHref: "/org/targets",
  overview:
    "Los empleados (Targets) son la audiencia de formación y checklists y se emparejan con Usuarios de acceso (normalmente el rol learner)—no son operadores de la organización. Gestione empleados en Empleados (CRUD y asistente CSV), abra un perfil de empleado para ver checklists conectados, mantenga departamentos como lista gestionada para formularios y organícelos en Grupos con un selector de miembros para que las campañas puedan dirigirse a departamentos enteros. Archive un grupo en soft-delete con status=inactive. Los packs de checklists publicados con autoasignación crean instancias al añadir un empleado nuevo.",
  example: {
    title: "Importación CSV de Finanzas antes del Q4",
    narrative:
      "Priya abre Importar empleados, sube finance-q4.csv (186 filas), mapea Email Address → email y guarda una plantilla de RR. HH., previsualiza los recuentos de crear/actualizar, confirma la importación y verifica que los checklists del Welcome Pack se autoasignaron en el perfil de una nueva incorporación.",
  },
  steps: [
    {
      title: "Abra Empleados",
      body: "Importe empleados y revise las puntuaciones de riesgo desde el espacio de Empleados.",
      href: "/org/targets",
    },
    {
      title: "Gestione departamentos",
      body: "Cree y mantenga departamentos en la página Departamentos y selecciónelos al añadir o importar empleados.",
      href: "/org/departments",
    },
    {
      title: "Cree o importe empleados",
      body: "Añada o edite una persona con el formulario de empleado (cargo, responsable, fecha de alta, teléfono, ubicación, tipo de empleo, idioma, zona horaria, riesgo). Use Importar empleados para un asistente: suba cualquier CSV de la empresa, mapee columnas a campos de la plataforma (email obligatorio), guarde opcionalmente una plantilla de mapeo por tenant, previsualice errores de fila y confirme. Los packs de autoasignación adjuntan checklists de onboarding y rellenan rol/inicio/responsable desde el perfil.",
    },
    {
      title: "Abra un perfil de empleado",
      body: "Use Abrir en una fila para revisar checklists conectados y conectar una plantilla o pack desde el perfil.",
    },
    {
      title: "Abra Grupos",
      body: "Cree grupos de audiencia aparte de la lista de empleados.",
      href: "/org/groups",
    },
    {
      title: "Elija miembros en el modal del grupo",
      body: "Nombre el grupo y seleccione empleados con el selector de miembros para que las campañas puedan dirigirse a departamentos enteros.",
    },
  ],
  diagram: {
    title: "Flujo de preparación de audiencia",
    nodes: [
      { id: "csv", label: "CSV / CRUD" },
      { id: "depts", label: "Departamentos" },
      { id: "groups", label: "Grupos" },
      { id: "risk", label: "Puntuaciones de riesgo" },
      { id: "ready", label: "Listo para campaña" },
    ],
    edges: [
      { from: "csv", to: "depts" },
      { from: "depts", to: "groups" },
      { from: "groups", to: "risk" },
      { from: "risk", to: "ready" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Empleados",
    stats: [
      { label: "Empleados", value: "186" },
      { label: "Departamentos", value: "6" },
      { label: "Grupos", value: "8" },
      { label: "Riesgo alto", value: "2" },
    ],
    highlight: {
      title: "Departamento de Finanzas",
      caption: "Importación CSV correcta · 186 empleados listos",
      progress: 100,
    },
    rows: [
      { title: "alex.ng@acme.test", meta: "Finanzas · Riesgo alto" },
      { title: "maya.cole@acme.test", meta: "Finanzas · Riesgo medio" },
      { title: "ops-all", meta: "Grupo · 64 miembros" },
    ],
    annotations: [
      {
        label: "CSV",
        note: "El asistente mapea columnas, simula errores de fila, hace upsert por email y crea departamentos por nombre cuando hace falta.",
      },
      {
        label: "Grupos",
        note: "Use el selector de miembros para que las campañas puedan dirigirse a departamentos enteros.",
      },
    ],
  },
  related: ["training", "checklists", "getting-started"],
};
