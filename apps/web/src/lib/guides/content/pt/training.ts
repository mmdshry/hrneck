import type { GuideModule } from "@/lib/guides/types";

export const trainingGuide: GuideModule = {
  slug: "training",
  title: "Formação de sensibilização de segurança",
  summary:
    "Crie cursos e questionários, atribua conteúdos, execute campanhas de lembrete e exporte o progresso ao nível da lição para as partes interessadas.",
  keywords: [
    "formação",
    "lms",
    "campanha",
    "curso",
    "questionário",
    "atribuir",
    "lembrete",
    "tempo de visualização",
    "ensaio",
    "exportação pdf",
    "cancelar",
    "arquivar",
  ],
  openInAppHref: "/org/training",
  overview:
    "Cursos contém a biblioteca (lições de artigo, vídeo e PDF mais questionários). Formação atribui um ou mais cursos a colaboradores e/ou grupos, executa campanhas que podem incluir vários cursos (arraste-os e defina a ordem) e enfileiram um lembrete por e-mail por destinatário no lançamento, com todos os cursos (via SMTP e perfis de envio), e revê o progresso por lição com exportação CSV ou PDF. Os formandos consomem o conteúdo atribuído no painel do colaborador em /portal—não na fila da org. Existe uma lista de exemplos secundária em /org/campaigns para demos rápidas; o fluxo do operador vive em Formação → Campanhas.",
  example: {
    title: "Campanha de sensibilização Q4 Finanças Acme",
    narrative:
      "Ops cria Phishing Essentials com três lições e um questionário obrigatório (80% de aprovação, limite de 15 minutos, um ensaio). Em Formação atribui o curso ao grupo Finanças (186 pessoas), lança Sensibilização de Segurança Q4 (um e-mail de lembrete enfileirado por destinatário), vê a conclusão subir de 12% para 86% e exporta o PDF do relatório de visualização para a liderança.",
  },
  steps: [
    {
      title: "Construa a biblioteca de cursos",
      body: "Crie cursos e lições em Cursos antes de atribuir qualquer coisa. Adicione questionários com pontuação de aprovação, flag de obrigatório, limite de tempo, escolha múltipla e perguntas de ensaio opcionais.",
      href: "/org/courses",
    },
    {
      title: "Atribua conteúdo",
      body: "Em Formação, selecione um ou mais cursos e atribua-os a colaboradores e/ou grupos. Os formandos veem as inscrições em /portal após a atribuição.",
      href: "/org/training",
    },
    {
      title: "Crie uma campanha",
      body: "Dê nome à campanha, escolha um ou mais cursos, selecione group_ids e/ou targets e lance. O lançamento enfileira um e-mail de lembrete por destinatário com todos os cursos da campanha—não há cadência semanal de lembretes. Confirme o SMTP e o perfil de envio primeiro.",
      href: "/org/training/campaigns",
    },
    {
      title: "Monitorize e exporte",
      body: "Acompanhe inscrição, estado da lição, tempo de visualização e carimbos de data/hora. Descarregue CSV ou PDF do relatório de visualização e depois cancele (para trabalhos de lembrete pendentes) ou arquive campanhas quando a vaga terminar.",
    },
  ],
  sections: [
    {
      title: "Biblioteca de cursos",
      body: "Tudo o que os formandos abrem mais tarde é criado aqui. Mantenha títulos claros e questionários alinhados com as lições que seguem.",
      steps: [
        {
          title: "Crie um curso",
          body: "Defina título, descrição e duração esperada. Os cursos são a unidade que atribui e contra a qual faz campanha.",
          href: "/org/courses",
        },
        {
          title: "Adicione lições",
          body: "Use lições de artigo/texto, vídeo (URL YouTube/Vimeo ou ficheiro carregado), áudio ou carregamento de documento (PDF, TXT, MD, DOC, DOCX) até 100 MB. Ordene as lições na sequência que os formandos devem concluir.",
        },
        {
          title: "Configure questionários",
          body: "Adicione um ou mais questionários por curso. Defina pontuação de aprovação, marque obrigatório vs opcional, adicione opcionalmente um limite de tempo com contagem decrescente, misture itens de escolha múltipla e inclua perguntas de ensaio sem pontuação quando precisar de respostas em texto livre.",
        },
        {
          title: "Carregue e transmita multimédia",
          body: "Use Pré-visualizar em Cursos para confirmar que streams de vídeo/áudio e documentos abrem antes de atribuir a uma audiência grande, para que o primeiro lembrete não encontre conteúdo partido.",
        },
      ],
    },
    {
      title: "Atribuir e acompanhar",
      body: "A atribuição cria inscrições. O acompanhamento é por formando e por lição—não apenas totais do funil da campanha.",
      steps: [
        {
          title: "Atribua um ou mais cursos",
          body: "Em Formação, escolha cursos e vise colaboradores e/ou grupos. Pode atribuir um item completo da biblioteca de cursos; as campanhas continuam a ser o caminho para vagas temporizadas com lembretes.",
          href: "/org/training",
        },
        {
          title: "Abra o relatório de visualização",
          body: "Inspecione o estado da lição por formando, tempo de visualização, aberto-em e concluído-em para que possa contactar pessoas em atraso pelo nome.",
        },
        {
          title: "Exporte CSV ou PDF",
          body: "Descarregue o relatório de visualização como CSV para folhas de cálculo ou PDF para packs de stakeholders. Combine com Relatórios para calendários à escala da org.",
        },
        {
          title: "Envie formandos para /portal",
          body: "Os operadores ficam em /org/training. Os formandos abrem o portal do formando para ler, ver, marcar como concluído e fazer questionários. Consulte o guia Portal do formando.",
          href: "/portal",
        },
      ],
    },
    {
      title: "Campanhas e lembretes",
      body: "As campanhas envolvem um ou mais cursos + audiência + um lembrete de utilização única no lançamento. Os estados incluem draft, scheduled, running, completed, cancelled e archived.",
      steps: [
        {
          title: "Lance a partir de Formação → Campanhas",
          body: "Dê nome à vaga, adicione um ou mais cursos, selecione grupos/colaboradores e lance. Cada destinatário recebe um e-mail de lembrete com todos os cursos da vaga—sem cadência semanal recorrente.",
          href: "/org/training/campaigns",
        },
        {
          title: "Organize os cursos da campanha",
          body: "Arraste um curso da biblioteca de cursos para uma campanha ou clique em Adicionar. Arraste as linhas ou use os botões para cima e para baixo para definir a ordem que os formandos vão ver. Os cursos só podem ser alterados enquanto a campanha estiver em rascunho ou agendada; a campanha fica concluída quando todos os seus cursos estiverem terminados.",
          href: "/org/training/campaigns",
        },
        {
          title: "Confirme o caminho de entrega",
          body: "O correio de lembrete usa o SMTP da org e o perfil de envio ativo. Verifique Integrações e Perfis de envio antes do primeiro envio.",
          href: "/org/settings/integrations",
        },
        {
          title: "Leia o funil da campanha",
          body: "Acompanhe inscrições, em progresso, concluídos, % abertos e % concluídos no cartão da campanha à medida que os formandos terminam as lições.",
        },
        {
          title: "Cancele ou arquive",
          body: "Cancele uma vaga draft, scheduled ou running para que trabalhos de lembrete pendentes não façam nada; arquive (PATCH ou DELETE para running/completed) para manter a lista limpa sem apagar o histórico.",
        },
        {
          title: "Conheça a página de campanhas de exemplo",
          body: "/org/campaigns é uma lista secundária de “lançar campanha de exemplo” (org.campaigns.manage). Não está na barra lateral; prefira Formação → Campanhas para vagas de produção.",
          href: "/org/campaigns",
        },
      ],
    },
  ],
  diagram: {
    title: "Ciclo de vida da campanha",
    nodes: [
      { id: "library", label: "Cursos" },
      { id: "audience", label: "Targets / grupos" },
      { id: "campaign", label: "Campanha" },
      { id: "mail", label: "Lembretes" },
      { id: "learn", label: "Portal do formando" },
      { id: "metrics", label: "Progresso + exportação" },
    ],
    edges: [
      { from: "library", to: "campaign" },
      { from: "audience", to: "campaign" },
      { from: "campaign", to: "mail" },
      { from: "campaign", to: "learn" },
      { from: "learn", to: "metrics" },
      { from: "mail", to: "metrics" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Campanhas de formação",
    stats: [
      { label: "Conclusão", value: "86%" },
      { label: "Atribuídos", value: "186" },
      { label: "Lembretes", value: "Utilização única" },
    ],
    highlight: {
      title: "Sensibilização de Segurança Q4",
      caption: "Grupo Finanças · Phishing Essentials · 38 em atraso",
      progress: 86,
    },
    rows: [
      { title: "Lição 1 · Identificar o isco", meta: "92% concluído · 4m média de visualização" },
      { title: "Questionário · Reportar phishing", meta: "81% aprovação · obrigatório · 15m" },
      { title: "Exportar relatório de visualização", meta: "CSV + PDF prontos" },
    ],
    annotations: [
      { label: "Cartão da campanha", note: "As métricas do funil atualizam-se à medida que os formandos terminam as lições." },
      { label: "Lembretes", note: "Um trabalho por destinatário no lançamento; cancelar para envios pendentes." },
    ],
  },
  related: ["learner-portal", "targets-groups", "settings", "reporting"],
};
