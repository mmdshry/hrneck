import type { LegalDocument } from "@/lib/legal/types";

export const privacyEs: LegalDocument = {
  slug: "privacy",
  title: "Política de privacidad",
  summary:
    "Cómo HRneck gestiona la información de salud protegida y otros datos personales como Business Associate de HIPAA, y las salvaguardas que mantenemos.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "scope",
      title: "Alcance y nuestra función",
      paragraphs: [
        "Esta Política de privacidad describe cómo HRneck («HRneck», «nosotros») recopila, usa, divulga y protege la información en el HRneck Training Portal, una plataforma de formación en concienciación de seguridad para proveedores de servicios gestionados (MSP) y organizaciones.",
        "Cuando un cliente que es entidad cubierta o business associate según la Health Insurance Portability and Accountability Act de 1996 y sus reglamentos (HIPAA) usa HRneck para crear, recibir, mantener o transmitir información de salud protegida (PHI), HRneck actúa como business associate de ese cliente. El Business Associate Agreement (BAA) entre HRneck y el cliente es el documento vinculante para la PHI. Si esta política y un BAA entran en conflicto sobre la PHI, prevalece el BAA.",
        "Esta política describe cómo operamos. No sustituye al BAA, al aviso de prácticas de privacidad del propio cliente ni a las obligaciones del cliente conforme a HIPAA.",
      ],
    },
    {
      id: "information",
      title: "Información que tratamos",
      paragraphs: [
        "Según cómo use el cliente HRneck, tratamos en su nombre las siguientes categorías de información:",
      ],
      bullets: [
        "Registros de personal y de destinatarios: nombres, correos electrónicos de trabajo, teléfonos, ubicaciones, números de empleado, departamentos y pertenencia a grupos.",
        "Registros de formación: inscripciones en cursos, progreso, resultados de cuestionarios y certificaciones de formación.",
        "Registros de simulaciones de phishing: eventos de campaña como entrega, aperturas, clics y envíos.",
        "Registros de mesa de servicio: tickets, notas, adjuntos y contenido de correos entrantes enviados a un buzón de tickets configurado.",
        "Registros de listas de comprobación de RR. HH.: plantillas, instancias, respuestas y archivos subidos.",
        "Datos de cuenta y autenticación: identificadores de inicio de sesión, hashes de contraseña, ajustes de autenticación multifactor (MFA), credenciales de passkey e identificadores de inicio de sesión único.",
        "Registros de actividad y auditoría: acciones realizadas por operadores y administradores dentro de un tenant.",
        "Datos técnicos: direcciones IP y registros de solicitudes necesarios para operar, proteger y resolver incidencias del servicio.",
      ],
    },
    {
      id: "phi",
      title: "Información de salud protegida",
      paragraphs: [
        "Los registros de empleo que una entidad cubierta conserva en su calidad de empleador están excluidos de la definición de PHI (45 CFR 160.103). Los datos de formación del personal y de listas de comprobación de RR. HH. que un cliente conserva como empleador son, por lo general, registros de empleo. Esta exclusión no cubre la información de salud de pacientes o clientes que se incluya en esos registros.",
        "Los clientes no deben introducir PHI en HRneck salvo que un BAA cubra ese uso. Los tickets, las respuestas de listas de comprobación, las notas, los archivos subidos y los mensajes enviados al Assistant son canales de texto libre y no deben contener PHI salvo que el BAA lo permita.",
        "Usamos y divulgamos PHI solo según lo que permita el BAA o lo que exija la ley (45 CFR 164.502(a)).",
      ],
    },
    {
      id: "use",
      title: "Cómo usamos y divulgamos la información",
      paragraphs: [
        "Usamos la información solo para prestar, proteger, dar soporte y mejorar los servicios de HRneck para el cliente, según lo descrito en el acuerdo con el cliente y en el BAA.",
        "No vendemos PHI ni la usamos con fines de marketing o publicidad.",
        "No usamos ni divulgamos PHI de una forma que el cliente no podría, salvo que el BAA lo permita expresamente. Cualquier desidentificación o análisis agregado solo se realiza cuando el BAA lo permite y de conformidad con 45 CFR 164.514.",
        "Divulgamos PHI a subcontratistas solo en las condiciones de la sección de subcontratistas y a las autoridades cuando la ley lo exija.",
      ],
    },
    {
      id: "safeguards",
      title: "Salvaguardas",
      paragraphs: [
        "Mantenemos salvaguardas administrativas, físicas y técnicas que protegen la confidencialidad, integridad y disponibilidad de la PHI electrónica, conforme a la Regla de Seguridad de HIPAA (45 CFR 164.302 a 164.318). Incluyen:",
      ],
      bullets: [
        "Control de acceso: identificadores de usuario únicos, permisos basados en roles y valores predeterminados de mínimo privilegio para cada cuenta de operador (45 CFR 164.312(a)).",
        "Cierre de sesión automático: las sesiones caducan tras un periodo de inactividad. La duración de sesión configurada es de 120 minutos [TBD: confirm the production value].",
        "Autenticación: requisitos de contraseña, contraseñas de un solo uso basadas en tiempo (TOTP), passkeys (WebAuthn) y códigos de recuperación de un solo uso (45 CFR 164.312(d)).",
        "Controles de auditoría: registros de actividad del tenant que documentan las acciones de administradores y operadores (45 CFR 164.312(b)). Los registros de actividad se depuran a los 180 días por defecto [TBD: confirm the retention setting for PHI-bearing tenants].",
        "Integridad: acceso a la API autenticado y validación en el servidor que protegen los registros frente a alteraciones indebidas (45 CFR 164.312(c)).",
        "Seguridad de la transmisión: conexiones cifradas (TLS) para el tráfico del navegador y de la API (45 CFR 164.312(e)) [TBD: confirm minimum TLS version].",
        "Cifrado: cifrado a nivel de aplicación (AES-256-CBC) para secretos almacenados, como credenciales de buzones [TBD: confirm encryption at rest for database storage and backups].",
        "Aislamiento de tenants: los datos de cada tenant se almacenan en su propia base de datos.",
        "Gestión de riesgos: análisis de riesgos y gestión de los riesgos identificados (45 CFR 164.308(a)(1)) [TBD: confirm review cadence].",
      ],
    },
    {
      id: "incidents",
      title: "Incidentes de seguridad y notificación de brechas",
      paragraphs: [
        "Registramos los incidentes de seguridad que afectan a la PHI y documentamos nuestra respuesta. Si descubrimos una brecha de PHI no protegida, notificaremos a la entidad cubierta afectada sin demora injustificada y en ningún caso después de [TBD: 5 business days] desde el descubrimiento, según 45 CFR 164.410. Si el BAA fija un plazo más corto, prevalece el BAA.",
        "En la medida en que se conozca, la notificación identificará a cada persona cuya PHI estuvo implicada, describirá qué ocurrió y los tipos de PHI afectados, describirá las medidas adoptadas y ofrecerá un contacto para consultas. Informaremos al cliente a medida que haya más información.",
        "Los clientes que sospechen de un incidente deben contactar de inmediato con el contacto de privacidad y seguridad indicado más abajo.",
      ],
    },
    {
      id: "subcontractors",
      title: "Subcontratistas y subencargados",
      paragraphs: [
        "Exigimos a los subcontratistas que creen, reciban, mantengan o transmitan PHI en nuestro nombre que acepten por escrito las mismas restricciones y condiciones que nos aplican (45 CFR 164.502(e)(1)(ii) y 164.308(b)).",
        "[TBD: publish the subprocessor list, including hosting, database and backup, email delivery (SMTP), DNS and content delivery, and Microsoft Copilot Studio if the Assistant is enabled for a tenant.] Los clientes pueden solicitar la lista vigente en cualquier momento.",
        "Cuando el Assistant está habilitado, los mensajes se envían a un servicio conversacional de terceros (Microsoft Copilot Studio). Los clientes no deben enviar PHI a través del Assistant salvo que el BAA cubra a este subencargado.",
      ],
    },
    {
      id: "individual_rights",
      title: "Derechos de las personas",
      paragraphs: [
        "Las personas cuya PHI se trata a través de HRneck deben dirigir sus solicitudes de acceso, modificación o historial de divulgaciones a la entidad cubierta que las emplea o les presta la atención. Ayudaremos a la entidad cubierta a responder estas solicitudes según exija el BAA (45 CFR 164.524, 164.526 y 164.528).",
        "Ponemos a disposición del Secretario del Departamento de Salud y Servicios Humanos de EE. UU. nuestras prácticas internas, libros y registros relativos a la PHI, a efectos de determinar el cumplimiento de HIPAA (45 CFR 164.504(e)(2)(ii)(I)).",
      ],
    },
    {
      id: "retention",
      title: "Conservación, devolución y destrucción",
      paragraphs: [
        "Conservamos la información del cliente solo durante el tiempo necesario para prestar el servicio, cumplir obligaciones legales y ejecutar el BAA.",
        "Cuando termina una suscripción o un BAA, devolveremos o destruiremos toda la PHI que mantenemos, cuando sea factible (45 CFR 164.504(e)(2)(ii)(J)). Tras la terminación, el cliente dispone de [TBD: 30] días para exportar sus datos antes de que comience la eliminación. La eliminación de copias de seguridad sigue [TBD: backup rotation period].",
        "Si la devolución o destrucción no es factible, limitaremos el uso y la divulgación posteriores de la PHI a los fines que hacen inviable su devolución o destrucción, y seguiremos protegiéndola.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies y sesiones",
      paragraphs: [
        "HRneck usa cookies esenciales para mantener la sesión iniciada y proteger las sesiones. No usamos cookies publicitarias de terceros. [TBD: confirm that no analytics or marketing cookies are loaded on the marketing pages.]",
      ],
    },
    {
      id: "changes",
      title: "Cambios en esta política",
      paragraphs: [
        "Podemos actualizar esta política periódicamente. Para cambios sustanciales, actualizaremos la fecha de vigencia y avisaremos por correo electrónico a los clientes con cuentas de administrador con al menos [TBD: 30] días de antelación, salvo que la ley o el BAA exijan un plazo menor.",
      ],
    },
    {
      id: "contact",
      title: "Contacto",
      paragraphs: [
        "Contacto de privacidad y seguridad: support@hrneck.com. [TBD: name a designated privacy officer and security officer.]",
        "HRneck, San Diego, California, Estados Unidos.",
        "Las personas que consideren que se han vulnerado sus derechos de privacidad pueden presentar una queja ante la entidad cubierta o ante el Departamento de Salud y Servicios Humanos de EE. UU., Oficina de Derechos Civiles (Office for Civil Rights).",
      ],
    },
  ],
};
