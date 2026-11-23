import type { GuideModule } from "@/lib/guides/types";

export const dashboardGuide: GuideModule = {
  slug: "dashboard",
  title: "Painel da organização",
  summary:
    "Consulte métricas em direto dos módulos que as suas permissões permitem e salte para os fluxos que precisam de atenção.",
  keywords: ["painel", "métricas", "ao vivo", "visão geral", "permissões", "postura"],
  openInAppHref: "/org",
  overview:
    "O painel da organização mostra widgets de métricas condicionados por permissões—conclusão e risco de formação, checklists abertas, pressão de ticketing e contagens de pessoas—em vez de um menu fixo de atalhos. Operadores com org.reports.view obtêm uma visão geral em direto do canal de relatórios detalhados; outros veem contagens específicas de módulo quando disponíveis.",
  example: {
    title: "Revisão de postura de segunda-feira",
    narrative:
      "Antes do standup, o Jordan abre /org e vê a conclusão da formação a 86%, checklists abertas e pressão de SLA no widget de ticketing. Faz deep-link para Formação e depois Ticketing, sem procurar uma grelha genérica de atalhos.",
  },
  steps: [
    {
      title: "Abra o painel",
      body: "Vá a Organização → Painel. Os widgets refletem o tenant com sessão iniciada e apenas as suas permissões.",
      href: "/org",
    },
    {
      title: "Leia os widgets que consegue ver",
      body: "Formação (relatórios ou gestão de formação), Checklists, Ticketing e Pessoas aparecem apenas quando tem a permissão correspondente.",
    },
    {
      title: "Faça deep-link para o trabalho",
      body: "Cada widget liga ao respetivo módulo para que possa agir sem usar o antigo menu de atalhos.",
    },
    {
      title: "Confie na atualização em direto quando os relatórios forem permitidos",
      body: "Com org.reports.view, os snapshots Reverb reports-detailed mantêm os cartões atualizados. Se o socket cair, a UI mostra Sincronização em direto indisponível e volta a ligar automaticamente—não há botão Atualizar.",
    },
  ],
  diagram: {
    title: "Fluxo de informação do painel",
    nodes: [
      { id: "perms", label: "Permissões" },
      { id: "api", label: "APIs da org" },
      { id: "ws", label: "Canal em direto" },
      { id: "cards", label: "Widgets de métricas" },
    ],
    edges: [
      { from: "perms", to: "cards", label: "filtro" },
      { from: "api", to: "cards", label: "snapshot" },
      { from: "ws", to: "cards", label: "atualizado" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Painel da org",
    stats: [
      { label: "Conclusão", value: "86%" },
      { label: "Checklists abertas", value: "3" },
      { label: "Tickets abertos", value: "14" },
    ],
    highlight: {
      title: "Postura de formação · Esta semana",
      caption: "412 atribuídos · Finanças ainda a recuperar · Destinatários sem ação assinalados",
      progress: 86,
    },
    rows: [
      { title: "Formação", meta: "86% concluído · 2 campanhas em curso" },
      { title: "Checklists", meta: "3 instâncias abertas" },
      { title: "Ticketing", meta: "14 abertos · vigilância de SLA" },
    ],
    annotations: [
      { label: "Filtro de permissão", note: "Os widgets ocultam-se quando não tem a permissão org.* correspondente." },
      { label: "Deep links", note: "Um clique para Formação, Checklists, Ticketing ou Utilizadores." },
    ],
  },
  related: ["training", "reporting", "targets-groups"],
};
