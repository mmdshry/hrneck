import type { GuideModule } from "@/lib/guides/types";

export const settingsGuide: GuideModule = {
  slug: "settings",
  title: "Ajustes y entrega",
  summary:
    "Personalice el tenant, aplique MFA, confirme SMTP, gestione perfiles de envío y revise la guía DNS de dominio personalizado.",
  keywords: [
    "ajustes",
    "smtp",
    "mfa",
    "branding",
    "envío",
    "dominio",
    "integraciones",
  ],
  openInAppHref: "/org/settings",
  overview:
    "Ajustes cubre la presentación white-label (nombre, color principal, logo, zona horaria), la configuración MFA de operadores, el estado de integración SMTP, los perfiles de envío saliente y la guía DNS de dominio de envío personalizado. Confirme el correo antes de lanzar campañas que dependen de recordatorios.",
  example: {
    title: "Checklist de correo para el go-live",
    narrative:
      "Antes del lanzamiento del Q4, DevOps define el nombre visible «Acme Security», el color principal al teal de marca, confirma que Integraciones muestra SMTP Conectado para mail.hrneck.com, crea el perfil de envío training@notify.acme.test y sigue la guía DNS del stub de dominio personalizado.",
  },
  steps: [
    {
      title: "Abra Ajustes",
      body: "Actualice el nombre visible, el color, el logo y la zona horaria del chrome del tenant.",
      href: "/org/settings",
    },
    {
      title: "Aplique MFA",
      body: "Haga que los operadores completen la configuración MFA desde Ajustes → MFA.",
      href: "/org/settings/mfa",
    },
    {
      title: "Verifique SMTP",
      body: "Integraciones debe mostrar Conectado antes de que los recordatorios de campaña se envíen de forma fiable.",
      href: "/org/settings/integrations",
    },
    {
      title: "Configure perfiles de envío",
      body: "Defina perfiles de dirección remitente usados por el correo de formación y notificaciones.",
      href: "/org/settings/sending-profiles",
    },
    {
      title: "Revise la guía DNS del dominio",
      body: "Siga el stub de dominio de envío personalizado cuando necesite raíces de correo de marca.",
    },
  ],
  diagram: {
    title: "Preparación del correo saliente",
    nodes: [
      { id: "brand", label: "Branding" },
      { id: "mfa", label: "MFA" },
      { id: "smtp", label: "Estado SMTP" },
      { id: "profile", label: "Perfil de envío" },
      { id: "campaign", label: "Correo de campaña" },
    ],
    edges: [
      { from: "brand", to: "smtp" },
      { from: "mfa", to: "smtp" },
      { from: "smtp", to: "profile" },
      { from: "profile", to: "campaign" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Ajustes · Integraciones",
    stats: [
      { label: "SMTP", value: "Conectado" },
      { label: "MFA", value: "Obligatorio" },
      { label: "Perfiles", value: "2" },
    ],
    highlight: {
      title: "mail.hrneck.com",
      caption: "Última prueba OK · listo para recordatorios de campaña",
      progress: 100,
    },
    rows: [
      {
        title: "training@notify.acme.test",
        meta: "Perfil de envío · Predeterminado",
      },
      { title: "Color principal", meta: "#083A6D · aplicado" },
      {
        title: "DNS de dominio personalizado",
        meta: "Stub de guía · corte pendiente",
      },
    ],
    annotations: [
      {
        label: "Integraciones",
        note: "El estado Conectado refuerza la confianza operativa.",
      },
      {
        label: "MFA",
        note: "Los operadores verifican códigos en /login/mfa; desactivar + códigos de recuperación viven en Ajustes → MFA.",
      },
    ],
  },
  related: ["auth", "training", "getting-started", "users-roles"],
};
