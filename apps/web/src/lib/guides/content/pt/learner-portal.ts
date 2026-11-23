import type { GuideModule } from "@/lib/guides/types";

export const learnerPortalGuide: GuideModule = {
  slug: "learner-portal",
  title: "Portal do formando",
  summary:
    "Conclua cursos atribuídos, veja lições com tempo de visualização registado, faça questionários e siga notificações de formação em /learn.",
  keywords: [
    "formando",
    "learn",
    "questionário",
    "curso",
    "inscrição",
    "tempo de visualização",
    "ensaio",
    "portal",
  ],
  openInAppHref: "/learn",
  overview:
    "O portal do formando é onde as pessoas inscritas consomem conteúdo de sensibilização de segurança. Os operadores atribuem cursos a partir de /org/training; os formandos iniciam sessão no host do tenant e abrem /learn para ver atribuições, ler artigos, ver vídeo carregado ou incorporado (o tempo de visualização é reportado), ver PDFs, marcar lições como concluídas e fazer questionários com pontuações de aprovação, flags opcionais, contagens decrescentes e respostas de ensaio. As checklists de RH nunca aparecem aqui. O sino de notificações no cabeçalho do formando apresenta eventos training_assigned com deep links de volta a /learn.",
  example: {
    title: "Analista de Finanças conclui Phishing Essentials",
    narrative:
      "A Maya abre /learn, vê Sensibilização de Segurança Q4 a 40%, vê a Lição 2 (4 minutos registados), marca-a como concluída e depois faz o questionário obrigatório com contagem decrescente de 15 minutos. Aprova com 88%, deixa um ensaio sobre “como reportaria um isco”, e o relatório de visualização da org atualiza a sua linha antes do próximo lembrete.",
  },
  steps: [
    {
      title: "Inicie sessão no host do tenant",
      body: "Use a conta da org em {slug}.hrneck.test. O MFA pode ser obrigatório. Os formandos não usam o MSP nem o admin Filament.",
      href: "/login",
    },
    {
      title: "Abra /learn",
      body: "Reveja os cursos atribuídos com estado e progresso. Apenas as inscrições criadas por atribuições de Formação ou campanhas aparecem.",
      href: "/learn",
    },
    {
      title: "Conclua as lições",
      body: "Leia artigos, veja vídeo (URL ou carregamento), abra PDFs e marque cada lição como concluída quando terminar.",
    },
    {
      title: "Faça questionários",
      body: "Respeite a pontuação de aprovação, obrigatório vs opcional e qualquer contagem decrescente. Responda a escolha múltipla e ensaios sem pontuação e depois submeta.",
    },
    {
      title: "Observe o sino de notificações",
      body: "Novas atribuições de formação aparecem no sino do cabeçalho do formando com um deep link para o curso.",
    },
  ],
  sections: [
    {
      title: "O que os formandos nunca veem",
      steps: [
        {
          title: "Sem checklists de RH",
          body: "Os formulários de onboarding/offboarding são só para admin em /org/checklists. Os colaboradores são registos de audiência; as instâncias de checklist são preenchidas por operadores de RH.",
        },
        {
          title: "Sem barra lateral de admin da org",
          body: "A criação de cursos, o lançamento de campanhas e a exportação do relatório de visualização ficam em /org para utilizadores com org.training.manage.",
        },
      ],
    },
  ],
  diagram: {
    title: "Percurso do formando",
    nodes: [
      { id: "assign", label: "Org atribui curso" },
      { id: "learn", label: "Lista /learn" },
      { id: "lesson", label: "Lição" },
      { id: "quiz", label: "Questionário" },
      { id: "report", label: "Relatório de visualização da org" },
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
      { label: "Em progresso", value: "1" },
      { label: "Concluídos", value: "1" },
    ],
    highlight: {
      title: "Phishing Essentials",
      caption: "Lição 2 de 3 · 4m vistos · questionário desbloqueia a seguir",
      progress: 66,
    },
    rows: [
      { title: "Lição 1 · Identificar o isco", meta: "Concluída" },
      { title: "Lição 2 · Ligações seguras", meta: "Em progresso · vídeo" },
      { title: "Questionário · Reportar phishing", meta: "Obrigatório · limite 15m" },
    ],
    annotations: [
      { label: "Tempo de visualização", note: "O progresso do vídeo reporta-se ao relatório de visualização da org." },
      { label: "Sino", note: "As notificações training_assigned fazem deep-link para /learn." },
    ],
  },
  related: ["training", "auth", "announcements-notifications"],
};
