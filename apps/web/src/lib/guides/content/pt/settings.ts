import type { GuideModule } from "@/lib/guides/types";

export const settingsGuide: GuideModule = {
  slug: "settings",
  title: "Definições e entrega",
  summary:
    "Marque o tenant, imponha MFA, confirme SMTP, gira perfis de envio e reveja a orientação DNS de domínio personalizado.",
  keywords: [
    "definições",
    "smtp",
    "mfa",
    "marca",
    "envio",
    "domínio",
    "integrações",
  ],
  openInAppHref: "/org/settings",
  overview:
    "Definições cobre apresentação white-label (nome, cor principal, logótipo, fuso horário), configuração de MFA para operadores, estado da integração SMTP, perfis de envio outbound e orientação DNS de domínio de envio personalizado. Confirme o correio antes de lançar campanhas que dependem de lembretes.",
  example: {
    title: "Checklist de correio para go-live",
    narrative:
      "Antes do lançamento do Q4, DevOps define o nome de apresentação “Acme Security”, a cor principal para o teal da marca, confirma que Integrações mostra SMTP Ligado para mail.hrneck.com, cria o perfil de envio training@notify.acme.test e segue a orientação DNS para o stub de domínio personalizado.",
  },
  steps: [
    {
      title: "Abra Definições",
      body: "Atualize nome de apresentação, cor, logótipo e fuso horário do chrome do tenant.",
      href: "/org/settings",
    },
    {
      title: "Imponha MFA",
      body: "Peça aos operadores que concluam a configuração de MFA em Definições → MFA.",
      href: "/org/settings/mfa",
    },
    {
      title: "Verifique o SMTP",
      body: "Integrações deve mostrar Ligado antes de os lembretes de campanha enviarem de forma fiável.",
      href: "/org/settings/integrations",
    },
    {
      title: "Configure perfis de envio",
      body: "Defina perfis de endereço de remetente usados pelo correio de formação e notificações.",
      href: "/org/settings/sending-profiles",
    },
    {
      title: "Reveja a orientação DNS do domínio",
      body: "Siga o stub de domínio de envio personalizado quando precisar de raízes de correio com marca.",
    },
  ],
  diagram: {
    title: "Prontidão de correio outbound",
    nodes: [
      { id: "brand", label: "Marca" },
      { id: "mfa", label: "MFA" },
      { id: "smtp", label: "Estado SMTP" },
      { id: "profile", label: "Perfil de envio" },
      { id: "campaign", label: "Correio de campanha" },
    ],
    edges: [
      { from: "brand", to: "smtp" },
      { from: "mfa", to: "smtp" },
      { from: "smtp", to: "profile" },
      { from: "profile", to: "campaign" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Definições · Integrações",
    stats: [
      { label: "SMTP", value: "Ligado" },
      { label: "MFA", value: "Obrigatório" },
      { label: "Perfis", value: "2" },
    ],
    highlight: {
      title: "mail.hrneck.com",
      caption: "Último smoke OK · pronto para lembretes de campanha",
      progress: 100,
    },
    rows: [
      { title: "training@notify.acme.test", meta: "Perfil de envio · Predefinido" },
      { title: "Cor principal", meta: "#083A6D · aplicada" },
      { title: "DNS de domínio personalizado", meta: "Stub de orientação · cutover pendente" },
    ],
    annotations: [
      { label: "Integrações", note: "O estado Ligado condiciona a confiança operacional." },
      { label: "MFA", note: "Os operadores verificam códigos em /login/mfa; desativar + códigos de recuperação vivem em Definições → MFA." },
    ],
  },
  related: ["auth", "training", "getting-started", "users-roles"],
};
