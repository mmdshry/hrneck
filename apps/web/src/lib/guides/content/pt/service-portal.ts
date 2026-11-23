import type { GuideModule } from "@/lib/guides/types";

export const servicePortalGuide: GuideModule = {
  slug: "service-portal",
  title: "Portal de serviço",
  summary:
    "Submeta e acompanhe os seus próprios tickets, adicione notas e navegue por artigos publicados da base de conhecimento a partir de /portal.",
  keywords: [
    "portal",
    "tickets",
    "kb",
    "base de conhecimento",
    "service desk",
    "utilizador final",
    "submeter",
  ],
  openInAppHref: "/portal/tickets",
  overview:
    "O portal de serviço é o lado voltado para o colaborador do ticketing. O acesso do tenant usa org.ticketing.portal—a função learner seed inclui apenas essa permissão—para que Utilizadores de colaboradores emparelhados possam abrir /portal para listar e submeter tickets, adicionar notas nos seus próprios pedidos e navegar por artigos KB publicados. Os técnicos continuam a trabalhar a fila em /org/ticketing. O cabeçalho do portal liga sempre Os meus tickets, Base de conhecimento e Learn; Técnico aparece apenas quando o utilizador com sessão iniciada também tem org.ticketing.tickets ou org.ticketing.admin (não para contas só learner).",
  example: {
    title: "Colaborador reporta uma fatura suspeita",
    narrative:
      "O Alex inicia sessão com uma conta learner, abre /portal/tickets, submete “PDF de fatura suspeito” com uma descrição curta, mais tarde adiciona uma nota com um screenshot e depois encontra o artigo KB publicado “Como reportar phishing” em /portal/kb após o service desk converter o INC-1842.",
  },
  steps: [
    {
      title: "Inicie sessão",
      body: "Use a conta do tenant. As APIs do portal requerem org.ticketing.portal; a função learner seed concede exatamente isso (sem acesso à fila da org).",
      href: "/login",
    },
    {
      title: "Abra Os meus tickets",
      body: "/portal redireciona para tickets. Liste os seus pedidos e abra um para detalhe.",
      href: "/portal/tickets",
    },
    {
      title: "Submeta um pedido",
      body: "Crie um novo ticket com título e descrição claros. Chega à fila da mesa da org para os técnicos.",
    },
    {
      title: "Adicione notas no seu ticket",
      body: "Faça follow-up com mais detalhe a partir da página de detalhe do ticket sem precisar da UI de ticketing da org.",
    },
    {
      title: "Navegue pela KB publicada",
      body: "Abra /portal/kb para artigos que o service desk publicou. Os rascunhos permanecem invisíveis aqui.",
      href: "/portal/kb",
    },
  ],
  sections: [
    {
      title: "Portal vs fila da org",
      steps: [
        {
          title: "Os colaboradores ficam em /portal",
          body: "Não espere administração de mesas, fundir em massa, editores de SLA ou leitores de e-mail no portal—são ferramentas de operador.",
        },
        {
          title: "Os técnicos usam /org/ticketing",
          body: "Triagem, SLA, ingestão IMAP e conversão ticket→KB vivem na app da org. Consulte o guia de ticketing ITIL.",
          href: "/org/ticketing",
        },
        {
          title: "Atalhos do cabeçalho",
          body: "Use Learn para atribuições de formação. Técnico só aparece quando tem org.ticketing.tickets ou org.ticketing.admin—utilizadores só learner ficam em /portal.",
        },
      ],
    },
  ],
  diagram: {
    title: "Fluxo de pedido do portal",
    nodes: [
      { id: "user", label: "Utilizador do portal" },
      { id: "ticket", label: "O meu ticket" },
      { id: "queue", label: "Fila da org" },
      { id: "kb", label: "KB publicada" },
    ],
    edges: [
      { from: "user", to: "ticket" },
      { from: "ticket", to: "queue" },
      { from: "queue", to: "kb", label: "converter" },
      { from: "kb", to: "user" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Portal · Os meus tickets",
    stats: [
      { label: "Abertos", value: "1" },
      { label: "Resolvidos", value: "3" },
      { label: "KB", value: "Publicada" },
    ],
    highlight: {
      title: "PDF de fatura suspeito",
      caption: "À espera do service desk · nota adicionada 10:21",
      progress: 35,
    },
    rows: [
      { title: "O meu pedido · PDF de fatura suspeito", meta: "Aberto" },
      { title: "KB · Como reportar phishing", meta: "Publicado" },
      { title: "Cabeçalho · Learn", meta: "Atribuições de formação" },
    ],
    annotations: [
      { label: "Âmbito", note: "Só vê os seus próprios tickets no portal." },
      { label: "KB", note: "Apenas artigos publicados aparecem em /portal/kb." },
    ],
  },
  related: ["ticketing", "learner-portal", "auth"],
};
