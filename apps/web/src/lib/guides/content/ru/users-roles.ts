import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Пользователи и роли",
  summary:
    "Приглашайте операторов и учащихся организации, создавайте пользовательские роли и сопоставляйте каталог разрешений — включая пресеты тикетинга.",
  keywords: ["пользователи", "роли", "rbac", "разрешения", "sd_admin", "learner", "доступ"],
  openInAppHref: "/org/users",
  overview:
    "Пользователи входа организации включают операторов (org_admin и пользовательские роли) и сотрудников. Каждый Сотрудник (Target) связан с Пользователем, который обычно имеет роль learner, чтобы входить в /learn и сервисный портал. Используйте Пользователи для приглашений и Роли для композиции разрешений по обучению, чек-листам, тикетингу, отчётам, настройкам и объявлениям. Тикетинг поставляется с пресет-ролями sd_admin, sd_technician, sd_user и kb_admin. Роли сотрудников платформы (platform_super_admin / platform_agent) — равные друг другу, а не иерархия над ролями организации — и входят в тенант через контекст MSP.",
  example: {
    title: "Роль техника service desk",
    narrative:
      "Админ создаёт роль «SD Technician» с org.ticketing.tickets и связанными разрешениями стола, приглашает lee@acme.test и проверяет, что Lee может делать triage инцидентов, но не менять брендинг в Настройках. Отдельно новый сотрудник в Сотрудники получает связанного Пользователя learner и может открыть /learn, не появляясь как оператор организации.",
  },
  steps: [
    {
      title: "Просмотрите существующих пользователей",
      body: "Подтвердите, у кого уже есть org_admin, learner или пользовательские роли в тенанте.",
      href: "/org/users",
    },
    {
      title: "Откройте Роли",
      body: "Изучите каталог разрешений и клонируйте или создайте роль, соответствующую работе.",
      href: "/org/roles",
    },
    {
      title: "Назначайте пресеты тикетинга осторожно",
      body: "Используйте пресеты sd_* / kb_admin, когда человеку нужен только scope service desk.",
    },
    {
      title: "Пригласите оператора или положитесь на связывание сотрудника",
      body: "Создайте оператора в Пользователи с нужной ролью или добавьте Сотрудника, чтобы ProvisionEmployeePair создал связанного Пользователя/вход learner.",
    },
    {
      title: "Проверьте принцип наименьших привилегий",
      body: "Войдите как этот пользователь (или просмотрите разрешения), чтобы убедиться, что Настройки и Пользователи остаются закрыты для не-админов. MFA доступен каждому вошедшему пользователю организации.",
    },
  ],
  diagram: {
    title: "Модель доступа",
    nodes: [
      { id: "user", label: "Пользователь (вход)" },
      { id: "role", label: "Роль" },
      { id: "perms", label: "Разрешения" },
      { id: "modules", label: "Модули организации" },
      { id: "target", label: "Target / сотрудник" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "связанный learner" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Роли",
    stats: [
      { label: "Пользователи", value: "9" },
      { label: "Пользовательские роли", value: "4" },
      { label: "Пресеты", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Тикеты + столы · без settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner · связанный Target" },
    ],
    annotations: [
      { label: "Каталог", note: "Разрешения применяются на /api/v1/org/*." },
      { label: "Сотрудники", note: "Сотрудники — пользователи входа через связывание Target↔User (learner)." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
