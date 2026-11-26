import type { GuideModule } from "@/lib/guides/types";

export const mspGuide: GuideModule = {
  slug: "msp",
  title: "Consola MSP",
  summary:
    "Explore organizaciones tenant como personal de plataforma, abra un contexto de administración de tenant y vuelva al directorio MSP.",
  keywords: [
    "msp",
    "plataforma",
    "tenant",
    "organizaciones",
    "personal",
    "entrar",
    "salir",
    "platform_super_admin",
    "platform_agent",
  ],
  openInAppHref: "/msp",
  overview:
    "La consola MSP en /msp es solo para personal de plataforma (platform_super_admin y platform_agent). Lista organizaciones tenant con sector, franja de empleados, estado y flags de formación, y permite Abrir administración del tenant—lo que entra en un contexto real de staff_tenant_id para que /org cargue ese cliente. Use Salir del tenant en el banner del entorno org para volver a /msp.",
  example: {
    title: "El personal ayuda a Acme antes del lanzamiento del Q4",
    narrative:
      "El agente de plataforma Jordan abre /msp, encuentra Acme (activo, 100–249 empleados, formación activada), pulsa Abrir administración del tenant, llega a /org con todos los permisos, verifica SMTP en Ajustes, luego elige Salir del tenant y vuelve al directorio MSP.",
  },
  steps: [
    {
      title: "Inicie sesión como personal de plataforma",
      body: "Use una cuenta de plataforma como admin@hrneck.test. Los usuarios solo de organización no pueden abrir /msp.",
      href: "/login",
    },
    {
      title: "Abra el directorio MSP",
      body: "Revise tenants: nombre, sector, franja de empleados (1–10 hasta 500+), activo/inactivo y formación activada/desactivada. Los hosts siguen {slug}.hrneck.test.",
      href: "/msp",
    },
    {
      title: "Abra la administración del tenant",
      body: "Entre en el tenant seleccionado. La app Next de la org carga con el contexto de tenant de personal y le trata como si tuviera todos los permisos de la org mientras esté dentro.",
    },
    {
      title: "Trabaje dentro de /org",
      body: "Use la barra lateral normal de la org (formación, empleados, ticketing, ajustes, etc.). Las métricas en vivo y las Guías se comportan como una sesión de org_admin.",
      href: "/org",
    },
    {
      title: "Salga del tenant",
      body: "Use el control Salir del tenant del banner para limpiar el contexto de personal y volver a /msp. Cambiar la contraseña también limpia el contexto de tenant de personal.",
    },
  ],
  sections: [
    {
      title: "MSP frente a org",
      steps: [
        {
          title: "MSP = directorio + entrada",
          body: "Next /msp es el directorio ligero de personal y el punto de entrada a la UI de org del cliente.",
        },
        {
          title: "Los usuarios de la org permanecen en su host",
          body: "Las cuentas org_admin inician sesión en {slug}.hrneck.test y nunca necesitan entrar/salir de MSP.",
        },
      ],
    },
  ],
  diagram: {
    title: "Contexto de tenant del personal",
    nodes: [
      { id: "login", label: "Acceso de plataforma" },
      { id: "msp", label: "Directorio /msp" },
      { id: "enter", label: "Entrar en el tenant" },
      { id: "org", label: "Espacio /org" },
      { id: "exit", label: "Salir del tenant" },
    ],
    edges: [
      { from: "login", to: "msp" },
      { from: "msp", to: "enter" },
      { from: "enter", to: "org" },
      { from: "org", to: "exit" },
      { from: "exit", to: "msp" },
    ],
  },
  mock: {
    chromeTitle: "HRneck · MSP · Organizaciones",
    stats: [
      { label: "Tenants", value: "3" },
      { label: "Activos", value: "3" },
      { label: "Contexto", value: "Ninguno" },
    ],
    highlight: {
      title: "Acme Corp",
      caption: "100–249 · formación activada · Abrir administración del tenant",
      progress: 100,
    },
    rows: [
      { title: "acme.hrneck.test", meta: "Activo · sector Servicios" },
      { title: "itneck.hrneck.test", meta: "Tenant de demostración" },
      { title: "Salir del tenant", meta: "Visible solo mientras está en /org" },
    ],
    annotations: [
      {
        label: "Entrar",
        note: "Establece staff_tenant_id antes de cargar /org.",
      },
      {
        label: "Alcance",
        note: "Solo platform_super_admin / platform_agent ven /msp.",
      },
    ],
  },
  related: ["getting-started", "auth", "settings", "users-roles"],
};
