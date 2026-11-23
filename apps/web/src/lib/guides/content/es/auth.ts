import type { GuideModule } from "@/lib/guides/types";

export const authGuide: GuideModule = {
  slug: "auth",
  title: "Inicio de sesión, MFA y contraseña",
  summary:
    "Inicie sesión en el host correcto, complete el MFA, restablezca una contraseña olvidada y comprenda la verificación del correo y los códigos de recuperación.",
  keywords: [
    "inicio de sesión",
    "mfa",
    "contraseña",
    "olvidada",
    "restablecer",
    "recuperación",
    "verificación",
    "sesión",
    "totp",
  ],
  openInAppHref: "/login",
  overview:
    "HRNECK usa sesiones por cookie en los hosts de tenant ({slug}.hrneck.test) y el alias de la app. El inicio de sesión admite recordar sesión, un filtro de verificación de correo (los usuarios creados por un administrador suelen estar ya verificados), MFA TOTP con códigos de recuperación de un solo uso, y flujos de olvidar/restablecer/cambiar contraseña. La configuración y desactivación de MFA están en Ajustes → MFA para operadores autenticados. El personal de plataforma y los usuarios de la organización comparten las mismas páginas de acceso, pero llegan a /msp o /org según el rol. Cambiar la contraseña limpia cualquier contexto de tenant de personal.",
  example: {
    title: "El administrador recupera el acceso antes del lanzamiento",
    narrative:
      "Sara olvida su contraseña la mañana del lanzamiento del Q4, usa /login/forgot, la restablece desde el enlace del correo, inicia sesión, completa /login/mfa con su autenticador y guarda nuevos códigos de recuperación desde Ajustes → MFA antes de asignar la campaña.",
  },
  steps: [
    {
      title: "Abra el host correcto",
      body: "Los usuarios de la organización usan {slug}.hrneck.test. Los tenants de demostración locales incluyen itneck, test y company. El personal de plataforma puede usar el host central y luego MSP.",
      href: "/login",
    },
    {
      title: "Inicie sesión",
      body: "Correo y contraseña con opción de recordar sesión. Los correos no verificados se bloquean hasta completar la verificación.",
    },
    {
      title: "Complete el MFA cuando se solicite",
      body: "Introduzca el código TOTP en /login/mfa. Si pierde el autenticador, use un código de recuperación de un solo uso y vuelva a registrar el MFA.",
      href: "/login/mfa",
    },
    {
      title: "Olvidar o restablecer la contraseña",
      body: "Use /login/forgot para solicitar un correo de restablecimiento y luego /login/reset con el token. Tras cambiar la contraseña, vuelva a entrar en cualquier tenant MSP que tuviera abierto.",
      href: "/login/forgot",
    },
    {
      title: "Gestione el MFA en Ajustes",
      body: "Los operadores autenticados configuran, confirman o desactivan el MFA y ven los códigos de recuperación en Ajustes → MFA.",
      href: "/org/settings/mfa",
    },
  ],
  sections: [
    {
      title: "Quién llega dónde",
      steps: [
        {
          title: "Operadores de la organización",
          body: "org_admin y los roles personalizados llegan a /org en el host de su tenant tras el MFA.",
        },
        {
          title: "Personal de plataforma",
          body: "platform_super_admin / platform_agent usan /msp y opcionalmente entran en un tenant. El MFA de Filament usa las mismas columnas de autenticador en admin.hrneck.test.",
        },
        {
          title: "Alumnos y usuarios del portal",
          body: "Mismas páginas de acceso; tras crear la sesión abren /learn o /portal según permisos e inscripción.",
        },
      ],
    },
  ],
  diagram: {
    title: "Ruta de autenticación",
    nodes: [
      { id: "host", label: "Host del tenant" },
      { id: "login", label: "Inicio de sesión" },
      { id: "mfa", label: "Desafío MFA" },
      { id: "app", label: "Org / MSP / Learn" },
      { id: "reset", label: "Olvidar / restablecer" },
    ],
    edges: [
      { from: "host", to: "login" },
      { from: "login", to: "mfa" },
      { from: "mfa", to: "app" },
      { from: "login", to: "reset" },
      { from: "reset", to: "login" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Iniciar sesión",
    stats: [
      { label: "MFA", value: "Obligatorio" },
      { label: "Sesión", value: "Cookie" },
      { label: "Host", value: "acme.hrneck.test" },
    ],
    highlight: {
      title: "Desafío del autenticador",
      caption: "Introduzca el código de 6 dígitos o un código de recuperación",
      progress: 100,
    },
    rows: [
      { title: "/login", meta: "Correo + contraseña" },
      { title: "/login/mfa", meta: "TOTP · códigos de recuperación" },
      { title: "/login/forgot", meta: "Correo de restablecimiento" },
    ],
    annotations: [
      {
        label: "Verificación",
        note: "Los usuarios no verificados no pueden superar el filtro de acceso.",
      },
      {
        label: "Contexto de personal",
        note: "El cambio de contraseña limpia el estado de entrada MSP.",
      },
    ],
  },
  related: ["getting-started", "msp", "settings", "learner-portal"],
};
