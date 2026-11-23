import type { GuideModule } from "@/lib/guides/types";

export const announcementsNotificationsGuide: GuideModule = {
  slug: "announcements-notifications",
  title: "Anúncios e notificações",
  summary:
    "Publique anúncios à escala da org e compreenda como o sino na app apresenta eventos de formação, checklist e ticket.",
  keywords: [
    "anúncios",
    "notificações",
    "sino",
    "publicar",
    "alertas",
  ],
  openInAppHref: "/org/announcements",
  overview:
    "Os anúncios permitem aos operadores difundir mensagens de título/corpo para a organização. O sino de notificações (no shell da org) agrega formação atribuída, checklist atribuída, ticket atribuído e eventos de anúncio com deep links—atualizado em direto via Reverb sem atualização manual.",
  example: {
    title: "Aviso de formação obrigatória",
    narrative:
      "Após lançar Sensibilização de Segurança Q4, a Mira publica “Concluir formação de phishing até sexta-feira”, e os operadores de Finanças veem tanto o anúncio como as notificações individuais de formação atribuída no sino com ligações para /learn ou o progresso da campanha.",
  },
  steps: [
    {
      title: "Abra Anúncios",
      body: "Crie um título e corpo claros para a mensagem à escala da org.",
      href: "/org/announcements",
    },
    {
      title: "Publique",
      body: "Publicar difunde notificações na app para os operadores elegíveis.",
    },
    {
      title: "Observe o sino",
      body: "O sino de notificações do shell lista eventos recentes; clique para ir ao recurso ligado.",
    },
    {
      title: "Correlacione com eventos do módulo",
      body: "Atribuições de formação, checklist e ticket também aparecem no mesmo sino sem um anúncio separado.",
    },
  ],
  diagram: {
    title: "Difusão de notificações",
    nodes: [
      { id: "event", label: "Evento do módulo" },
      { id: "announce", label: "Anúncio" },
      { id: "bell", label: "Sino de notificações" },
      { id: "deep", label: "Deep link" },
    ],
    edges: [
      { from: "event", to: "bell" },
      { from: "announce", to: "bell" },
      { from: "bell", to: "deep" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Notificações",
    stats: [
      { label: "Não lidas", value: "4" },
      { label: "Anúncios", value: "1 novo" },
      { label: "Formação", value: "2 atribuídas" },
    ],
    highlight: {
      title: "Concluir formação de phishing até sexta-feira",
      caption: "Publicado 10:02 · visível em toda a org",
      progress: 100,
    },
    rows: [
      { title: "Formação atribuída · Phishing Essentials", meta: "Deep link · /learn" },
      { title: "Ticket atribuído · INC-1842", meta: "Deep link · ticketing" },
      { title: "Checklist atribuída · Acesso IT", meta: "Deep link · instâncias" },
    ],
    annotations: [
      { label: "Sino", note: "Vive no cabeçalho do shell da org para utilizadores com sessão iniciada." },
      { label: "Tempo real", note: "O polling cobre lacunas quando o WebSocket está offline." },
    ],
  },
  related: ["training", "ticketing", "checklists"],
};
