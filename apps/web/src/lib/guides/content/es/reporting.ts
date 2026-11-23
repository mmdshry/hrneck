import type { GuideModule } from "@/lib/guides/types";

export const reportingGuide: GuideModule = {
  slug: "reporting",
  title: "Informes y exportación PDF",
  summary:
    "Explore pestañas de informes detallados, programe CSV por correo y exporte PDF trimestrales con archivos.",
  keywords: [
    "informes",
    "pdf",
    "csv",
    "programación",
    "exportación",
    "analítica",
    "archivo",
  ],
  openInAppHref: "/org/reports",
  overview:
    "Informes cubre paneles de resumen más pestañas detalladas (empresa, usuarios, targets, campañas, formación, checklists, ticketing) con descarga CSV. Programe informes por correo mensuales/semanales/trimestrales, exporte PDF trimestrales desde la UI del calendario y explore archivos (purgados a los seis meses).",
  example: {
    title: "Pack para el consejo del Q4",
    narrative:
      "El primer lunes de enero, Mira abre Exportar, selecciona Q4, genera el pack DomPDF con finalización de formación y riesgo, descarga el archivo y confirma que el CSV trimestral programado también se envió a leadership@acme.test.",
  },
  steps: [
    {
      title: "Abra Informes",
      body: "Revise las tarjetas de resumen y cambie a las pestañas detalladas del dominio que necesite.",
      href: "/org/reports",
    },
    {
      title: "Descargue CSV",
      body: "Cada pestaña detallada ofrece una descarga CSV para análisis offline.",
    },
    {
      title: "Programe informes por correo",
      body: "Configure cadencias mensuales, semanales o trimestrales para que las partes interesadas reciban el CSV automáticamente.",
      href: "/org/reports",
    },
    {
      title: "Exporte el PDF trimestral",
      body: "Use el calendario de exportación para generar y descargar archivos DomPDF.",
      href: "/org/reports/export",
    },
    {
      title: "Consulte los archivos",
      body: "Vuelva a descargar exportaciones anteriores desde la lista de archivos; las de más de seis meses se purgan.",
    },
  ],
  diagram: {
    title: "Rutas de entrega de informes",
    nodes: [
      { id: "tabs", label: "Pestañas de informe" },
      { id: "csv", label: "Descarga CSV" },
      { id: "schedule", label: "Programación por correo" },
      { id: "pdf", label: "PDF trimestral" },
      { id: "archive", label: "Archivos" },
    ],
    edges: [
      { from: "tabs", to: "csv" },
      { from: "tabs", to: "schedule" },
      { from: "tabs", to: "pdf" },
      { from: "pdf", to: "archive" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Exportación de informes",
    stats: [
      { label: "PDF Q4", value: "Listo" },
      { label: "Programaciones", value: "3" },
      { label: "Archivos", value: "5" },
    ],
    highlight: {
      title: "Pack trimestral · 2025 Q4",
      caption: "Formación + riesgo + resumen de checklists · 2,4 MB",
      progress: 100,
    },
    rows: [
      { title: "Finalización de formación", meta: "CSV · Semanal a ops@" },
      { title: "Volumen de ticketing", meta: "CSV · Mensual" },
      { title: "Archivo PDF Q3", meta: "Conservado · 4 meses restantes" },
    ],
    annotations: [
      {
        label: "Calendario",
        note: "Elija un trimestre, genere y descargue.",
      },
      {
        label: "Webhook stub",
        note: "Los hooks de entrega están preparados para automatización futura.",
      },
    ],
  },
  related: ["training", "checklists", "ticketing"],
};
