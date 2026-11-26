import type { LegalDocument } from "@/lib/legal/types";

export const termsEs: LegalDocument = {
  slug: "terms",
  title: "Condiciones del servicio",
  summary:
    "Las normas para usar el HRNECK Training Portal, incluido cómo se aplica el Business Associate Agreement a la información de salud protegida.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "acceptance",
      title: "Aceptación de estas condiciones",
      paragraphs: [
        "Estas Condiciones del servicio («Condiciones») regulan el acceso y el uso del HRNECK Training Portal y de los servicios relacionados (los «Servicios») que presta HRNECK («HRNECK», «nosotros»). Al crear una cuenta, iniciar sesión o usar los Servicios en nombre de una organización, usted acepta estas Condiciones. Si las acepta en nombre de una organización, declara que tiene autoridad para obligarla.",
        "Si no está de acuerdo con estas Condiciones, no use los Servicios.",
      ],
    },
    {
      id: "definitions",
      title: "Definiciones",
      paragraphs: ["En estas Condiciones:"],
      bullets: [
        "Cliente: el MSP u organización que tiene un contrato con HRNECK para los Servicios.",
        "Usuarios: personas que acceden a los Servicios en nombre de un Cliente, incluidos operadores, administradores, alumnos y usuarios de la mesa de servicio.",
        "PHI: información de salud protegida tal como se define en 45 CFR 160.103.",
        "BAA: un Business Associate Agreement por escrito entre HRNECK y un Cliente que cumple 45 CFR 164.504(e) y 164.308(b).",
        "Tenant: el espacio de trabajo aislado de un Cliente dentro de los Servicios.",
      ],
    },
    {
      id: "services",
      title: "Los Servicios",
      paragraphs: [
        "Los Servicios incluyen formación y campañas de concienciación en seguridad, gestión del aprendizaje, listas de comprobación de RR. HH., gestión de servicios de TI y tickets, informes y exportaciones, portales para alumnos y de servicio, y funciones opcionales de asistente de IA. Las funciones disponibles para un Cliente dependen de su plan de suscripción y de los ajustes activados. [TBD: state the availability target and support hours, or reference the service level agreement.]",
      ],
    },
    {
      id: "baa",
      title: "Business Associate Agreement y orden de prevalencia",
      paragraphs: [
        "Un Cliente que sea entidad cubierta o business associate debe firmar un BAA con HRNECK antes de crear, recibir, mantener o transmitir PHI en los Servicios.",
        "El BAA regula cómo HRNECK puede usar y divulgar la PHI y establece las obligaciones de seguridad, notificación de brechas, subcontratistas y devolución o destrucción. Si estas Condiciones y un BAA entran en conflicto en cuanto a la PHI, prevalece el BAA. En todo lo demás, prevalecen estas Condiciones.",
      ],
    },
    {
      id: "phi_restrictions",
      title: "Restricciones sobre PHI",
      paragraphs: ["Los Clientes y Usuarios deben cumplir lo siguiente:"],
      bullets: [
        "No introduzca PHI en los Servicios salvo que esté vigente un BAA que cubra ese uso.",
        "No incluya PHI en campos de texto libre, títulos o cuerpos de tickets, notas de listas de comprobación, archivos subidos, correos enviados a un buzón de tickets ni mensajes enviados al Assistant, salvo que el BAA lo permita expresamente.",
        "Aplique el estándar de mínimo necesario. Limite la PHI a lo que requiera la finalidad.",
        "No use PHI real en demostraciones, tenants de prueba ni contenido de simulaciones de phishing.",
        "Si consideramos razonablemente que la PHI se ha colocado en un canal que el BAA no cubre, podremos restringir la función o los datos afectados y avisaremos al Cliente lo antes posible.",
      ],
    },
    {
      id: "accounts",
      title: "Cuentas y acceso",
      paragraphs: ["Los Clientes y Usuarios deben cumplir estas reglas:"],
      bullets: [
        "Cada Usuario debe tener una cuenta individual. Las credenciales no deben compartirse.",
        "Los Clientes gestionan a los Usuarios, roles y permisos, y deben retirar el acceso cuando una persona deja la organización o cambia de función.",
        "Los Clientes deben activar la MFA en todas las cuentas de administrador y operador.",
        "Usted es responsable de la actividad de su cuenta y debe notificarnos de inmediato cualquier sospecha de acceso no autorizado.",
      ],
    },
    {
      id: "acceptable_use",
      title: "Uso aceptable",
      paragraphs: ["No debe:"],
      bullets: [
        "Usar los Servicios para fines ilícitos o para vulnerar los derechos de terceros.",
        "Intentar acceder al tenant, los datos o las cuentas de otro Cliente, ni sondear, escanear o probar la seguridad de los Servicios sin nuestro permiso por escrito.",
        "Interferir en el funcionamiento o la disponibilidad de los Servicios, incluso mediante solicitudes automatizadas excesivas.",
        "Ejecutar simulaciones de phishing o enviar formación solo a personas que esté autorizado a evaluar o formar, cumpliendo las leyes laborales y de comunicaciones aplicables.",
        "Subir código malicioso o contenido que infrinja la propiedad intelectual de terceros.",
      ],
    },
    {
      id: "customer_responsibilities",
      title: "Responsabilidades del Cliente",
      paragraphs: [
        "El Cliente es responsable de la exactitud y la licitud de la información que proporciona; de dar los avisos y obtener los consentimientos necesarios para la formación y el control de los empleados; de configurar los Servicios conforme a sus propias políticas de HIPAA y a su análisis de riesgos; y de formar a sus propios Usuarios.",
      ],
    },
    {
      id: "assistant",
      title: "Funciones de asistente de IA",
      paragraphs: [
        "Cuando una organización activa el Assistant, los mensajes del usuario y el contexto relacionado de tickets o formación pueden ser tratados por un servicio conversacional de terceros, actualmente Microsoft Copilot Studio. Las respuestas del Assistant pueden ser inexactas y deben revisarse antes de utilizarlas. No envíe PHI a través del Assistant salvo que el BAA cubra a este subencargado. [TBD: confirm subprocessor status and BAA coverage for Microsoft Copilot Studio.]",
      ],
    },
    {
      id: "fees",
      title: "Tarifas, pruebas y suscripciones",
      paragraphs: [
        "Las tarifas, las condiciones de facturación, los periodos de prueba y los límites del plan se establecen en el formulario de pedido, el plan de suscripción o los precios mostrados al registrarse. Podemos suspender los Servicios por impago tras un aviso razonable [TBD: confirm notice period].",
      ],
    },
    {
      id: "intellectual_property",
      title: "Propiedad intelectual",
      paragraphs: [
        "HRNECK y sus licenciantes son titulares de los Servicios, incluidos el software, los diseños y la documentación. Le concedemos un derecho limitado, no exclusivo e intransferible a usar los Servicios durante su suscripción. Los Clientes son propietarios de sus datos. Usted nos concede los derechos necesarios para alojar y tratar esos datos con el fin de prestar los Servicios.",
      ],
    },
    {
      id: "disclaimers",
      title: "Exenciones de responsabilidad",
      paragraphs: [
        "En la medida permitida por la ley, los Servicios se proporcionan «tal cual» y «según disponibilidad». La formación en concienciación de seguridad y las funciones de apoyo a HIPAA ayudan a reducir el riesgo, pero por sí solas no hacen que un Cliente cumpla HIPAA ni ninguna otra ley.",
      ],
    },
    {
      id: "liability",
      title: "Limitación de responsabilidad",
      paragraphs: [
        "En la máxima medida permitida por la ley, HRNECK no responde de daños indirectos, incidentales, especiales, consecuentes o punitivos. Nuestra responsabilidad total se limita a las tarifas que el Cliente haya pagado por los Servicios en los doce meses anteriores al hecho que dé lugar a la reclamación [TBD: confirm cap]. Cuando un BAA fije sus propias condiciones de responsabilidad por la PHI, esas condiciones se aplican a la PHI. Nada en estas Condiciones limita la responsabilidad que la ley no permite limitar.",
      ],
    },
    {
      id: "termination",
      title: "Terminación",
      paragraphs: [
        "Cualquiera de las partes puede dar por terminada la suscripción según lo establecido en el formulario de pedido o el plan. Podemos suspender o terminar el acceso de inmediato si incumple de forma sustancial estas Condiciones o el BAA, o si mantener el acceso supondría un riesgo para la seguridad.",
        "Al terminar la suscripción, su acceso finaliza y HRNECK devolverá o destruirá la PHI según lo descrito en la Política de privacidad y en el BAA. Las secciones sobre propiedad intelectual, exenciones de responsabilidad, limitación de responsabilidad y ley aplicable sobreviven a la terminación.",
      ],
    },
    {
      id: "governing_law",
      title: "Ley aplicable y controversias",
      paragraphs: [
        "Estas Condiciones se rigen por las leyes del Estado de California, Estados Unidos, sin tener en cuenta sus normas de conflicto de leyes [TBD: confirm governing law]. Los tribunales estatales y federales con sede en el condado de San Diego, California, tienen jurisdicción exclusiva, salvo que el BAA o el formulario de pedido disponga otra cosa.",
      ],
    },
    {
      id: "changes",
      title: "Cambios en estas Condiciones",
      paragraphs: [
        "Podemos actualizar estas Condiciones. Actualizaremos la fecha de vigencia y avisaremos por correo electrónico a las cuentas de administrador con al menos [TBD: 30] días de antelación a la entrada en vigor de los cambios sustanciales. El uso continuado de los Servicios tras la fecha de vigencia implica la aceptación de las Condiciones actualizadas.",
      ],
    },
    {
      id: "contact",
      title: "Contacto",
      paragraphs: [
        "Las consultas sobre estas Condiciones pueden enviarse a support@hrneck.com. Las notificaciones legales deben dirigirse a HRNECK, San Diego, California, Estados Unidos. [TBD: confirm the legal entity name and notice address.]",
      ],
    },
  ],
};
