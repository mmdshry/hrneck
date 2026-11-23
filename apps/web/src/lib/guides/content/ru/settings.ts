import type { GuideModule } from "@/lib/guides/types";

export const settingsGuide: GuideModule = {
  slug: "settings",
  title: "Настройки и доставка",
  summary:
    "Брендируйте тенант, требуйте MFA, подтвердите SMTP, управляйте профилями отправки и изучите DNS-руководство для пользовательского домена.",
  keywords: [
    "настройки",
    "smtp",
    "mfa",
    "брендинг",
    "отправка",
    "домен",
    "интеграции",
  ],
  openInAppHref: "/org/settings",
  overview:
    "Настройки покрывают white-label отображение (имя, основной цвет, логотип, часовой пояс), настройку MFA для операторов, статус интеграции SMTP, исходящие профили отправки и DNS-руководство для пользовательского домена отправки. Подтвердите почту перед запуском кампаний, которые зависят от напоминаний.",
  example: {
    title: "Чек-лист почты перед go-live",
    narrative:
      "Перед запуском Q4 DevOps задаёт отображаемое имя «Acme Security», основной цвет в брендовый teal, подтверждает, что Интеграции показывают SMTP Подключён для mail.hrneck.com, создаёт профиль отправки training@notify.acme.test и следует DNS-руководству для заглушки пользовательского домена.",
  },
  steps: [
    {
      title: "Откройте Настройки",
      body: "Обновите отображаемое имя, цвет, логотип и часовой пояс для chrome тенанта.",
      href: "/org/settings",
    },
    {
      title: "Требуйте MFA",
      body: "Попросите операторов завершить настройку MFA в Настройки → MFA.",
      href: "/org/settings/mfa",
    },
    {
      title: "Проверьте SMTP",
      body: "Интеграции должны показывать Подключён, прежде чем напоминания кампаний будут отправляться надёжно.",
      href: "/org/settings/integrations",
    },
    {
      title: "Настройте профили отправки",
      body: "Определите профили адреса отправителя для почты обучения и уведомлений.",
      href: "/org/settings/sending-profiles",
    },
    {
      title: "Изучите DNS-руководство домена",
      body: "Следуйте заглушке пользовательского домена отправки, когда нужны брендированные корни почты.",
    },
  ],
  diagram: {
    title: "Готовность исходящей почты",
    nodes: [
      { id: "brand", label: "Брендинг" },
      { id: "mfa", label: "MFA" },
      { id: "smtp", label: "Статус SMTP" },
      { id: "profile", label: "Профиль отправки" },
      { id: "campaign", label: "Почта кампании" },
    ],
    edges: [
      { from: "brand", to: "smtp" },
      { from: "mfa", to: "smtp" },
      { from: "smtp", to: "profile" },
      { from: "profile", to: "campaign" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Настройки · Интеграции",
    stats: [
      { label: "SMTP", value: "Подключён" },
      { label: "MFA", value: "Обязателен" },
      { label: "Профили", value: "2" },
    ],
    highlight: {
      title: "mail.hrneck.com",
      caption: "Последний smoke OK · готово к напоминаниям кампаний",
      progress: 100,
    },
    rows: [
      { title: "training@notify.acme.test", meta: "Профиль отправки · По умолчанию" },
      { title: "Основной цвет", meta: "#083A6D · применён" },
      { title: "DNS пользовательского домена", meta: "Заглушка руководства · cutover ожидает" },
    ],
    annotations: [
      { label: "Интеграции", note: "Статус Подключён задаёт операционную уверенность." },
      { label: "MFA", note: "Операторы проверяют коды на /login/mfa; отключение + коды восстановления живут в Настройки → MFA." },
    ],
  },
  related: ["auth", "training", "getting-started", "users-roles"],
};
