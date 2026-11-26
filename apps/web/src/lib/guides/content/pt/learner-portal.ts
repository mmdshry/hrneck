import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Portal do formando",
  summary:
    "Conclua os cursos atribuídos, veja lições com tempo de visualização registado, faça questionários e acompanhe notificações de formação a partir do seu painel de colaborador em /portal.",
  keywords: [
    "formando",
    "learn",
    "painel",
    "questionário",
    "curso",
    "inscrição",
    "watch time",
    "essay",
    "portal",
  ],
  openInAppHref: "/portal",
  overview:
    "Os colaboradores chegam ao painel em /portal após o início de sessão. Os meus cursos lista a formação de sensibilização para a segurança atribuída: os operadores atribuem cursos a partir de /org/training e os formandos abrem cada curso para ver lições, ler artigos, ver vídeo carregado ou incorporado (o tempo de visualização é reportado), abrir PDFs, marcar lições como concluídas e fazer questionários com notas de aprovação, indicadores opcionais, contagens decrescentes e respostas de ensaio. O mesmo painel liga para Os meus tickets e para a Base de conhecimento. As checklists de RH nunca aparecem aqui. O sino de notificações mostra eventos training_assigned com ligações diretas de volta a /portal. O plano pode desativar Os meus cursos; o resto do painel continua a funcionar.",
  example: {
    title: "Analista financeiro conclui Phishing Essentials",
    narrative:
      "A Maya abre /portal, vê Sensibilização de Segurança Q4 em Os meus cursos a 40 %, vê a Lição 2 (4 minutos registados), marca-a como concluída e depois faz o questionário obrigatório com uma contagem decrescente de 15 minutos. Aprova com 88 %, deixa um ensaio sobre «como reportaria uma isca» e o relatório de visualização da org atualiza a linha dela antes do próximo lembrete.",
  },
  steps: [
    {
      title: "Inicie sessão no host do tenant",
      body: "Use a sua conta da organização em {slug}.hrneck.test. Pode ser exigida MFA. Os formandos não usam a consola MSP.",
      href: "/login",
    },
    {
      title: "Abra o seu painel em /portal",
      body: "Os meus cursos mostra a formação atribuída com estado e progresso. Só aparecem as inscrições criadas por atribuições de formação ou campanhas. Os meus tickets e a Base de conhecimento estão a um clique.",
      href: "/portal",
    },
    {
      title: "Conclua as lições",
      body: "Leia artigos, veja vídeo (URL ou carregamento), abra PDFs e marque cada lição como concluída quando terminar.",
    },
    {
      title: "Faça os questionários",
      body: "Respeite a nota de aprovação, o carácter obrigatório ou opcional e qualquer contagem decrescente. Responda a escolhas múltiplas e a ensaios sem pontuação, e submeta.",
    },
    {
      title: "Acompanhe o sino de notificações",
      body: "Novas atribuições de formação aparecem no sino com uma ligação direta para o curso no seu painel.",
    },
  ],
  sections: [
    {
      title: "O que os formandos nunca veem",
      steps: [
        {
          title: "Sem checklists de RH",
          body: "Os formulários de integração/saída são apenas para administradores em /org/checklists. Os colaboradores são registos de público; as instâncias de checklist são preenchidas pelos operadores de RH.",
        },
        {
          title: "Sem barra lateral de administração da org",
          body: "A criação de cursos, o lançamento de campanhas e a exportação do relatório de visualização permanecem em /org para utilizadores com org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Percurso do formando",
    nodes: [
      { id: "assign", label: "A org atribui o curso" },
      { id: "learn", label: "Os meus cursos em /portal" },
      { id: "lesson", label: "Lição" },
      { id: "quiz", label: "Questionário" },
      { id: "report", label: "Relatório de visualização" },
    ],
    edges: [
      { from: "assign", to: "learn" },
      { from: "learn", to: "lesson" },
      { from: "lesson", to: "quiz" },
      { from: "quiz", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Formando · Os meus cursos",
    stats: [
      { label: "Atribuídos", value: "2" },
      { label: "Em curso", value: "1" },
      { label: "Concluídos", value: "1" },
    ],
    highlight: {
      title: "Phishing Essentials",
      caption: "Lição 2 de 3 · 4 min vistos · questionário desbloqueado a seguir",
      progress: 66,
    },
    rows: [
      { title: "Lição 1 · Identificar a isca", meta: "Concluída" },
      { title: "Lição 2 · Ligações seguras", meta: "Em curso · vídeo" },
      { title: "Questionário · Reportar phishing", meta: "Obrigatório · limite 15 min" },
    ],
    annotations: [
      { label: "Tempo de visualização", note: "O progresso do vídeo é reportado ao relatório de visualização da org." },
      { label: "Sino", note: "As notificações training_assigned ligam diretamente a /portal." },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
