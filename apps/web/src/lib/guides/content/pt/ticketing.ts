import type { GuideModule } from "@/lib/guides/types";

export const ticketingGuide: GuideModule = {
  slug: "ticketing",
  title: "Ticketing ITIL e KB",
  summary:
    "Gira mesas de Incident, Problem, Service Request e Change com SLA, operações em massa, ingestão de e-mail, KB, pesquisa e relatórios CSV/JSON.",
  keywords: [
    "ticketing",
    "incident",
    "sla",
    "kb",
    "email",
    "mesa",
    "service desk",
    "massa",
    "imap",
    "escalamento",
    "procedimentos",
    "preferências",
    "fundir",
  ],
  openInAppHref: "/org/ticketing",
  overview:
    "O módulo de ticketing cobre o básico de service desk ITIL para operadores em /org/ticketing: mesas, tickets com notas/tarefas/anexos, ações em massa, procedimentos e escalamento, políticas de SLA, leitores de e-mail IMAP, artigos KB (incluindo conversão ticket→KB), Search All, preferências e relatórios CSV/PDF/JSON. Os colaboradores submetem e acompanham trabalho no portal de serviço separado (/portal)—consulte esse guia para os passos do utilizador final. As permissões dividem-se por org.ticketing.tickets, .admin, .kb, .reports e .portal, com funções seed sd_* / kb_admin.",
  example: {
    title: "Relatório de phishing torna-se artigo KB",
    narrative:
      "O técnico Lee cria o Incident INC-1842 “PDF de fatura suspeito”, adiciona uma nota e uma tarefa de contenção, anexa a amostra, resolve-o dentro do SLA, converte o ticket num artigo KB “Como reportar phishing”, confirma Search All e KB publicado no portal e descarrega o CSV semanal de ticketing para o standup do service desk.",
  },
  steps: [
    {
      title: "Abra a fila de tickets",
      body: "Filtre por mesa, etapa, responsável e estado arquivado a partir do hub de ticketing.",
      href: "/org/ticketing",
    },
    {
      title: "Faça triagem de um ticket",
      body: "Capture notas, tarefas e anexos; mude etapas; copie ou ligue tickets relacionados conforme necessário.",
    },
    {
      title: "Configure mesas, SLA e e-mail",
      body: "Reveja mesas ITIL, procedimentos e SLA em Mesas; ligue leitores IMAP em E-mail.",
      href: "/org/ticketing/desks",
    },
    {
      title: "Publique conhecimento e exporte",
      body: "Converta tickets resolvidos em KB, verifique Search All / visibilidade no portal e depois exporte packs CSV/PDF ou JSON.",
      href: "/org/ticketing/kb",
    },
  ],
  sections: [
    {
      title: "Triagem da fila",
      body: "Operadores com org.ticketing.tickets trabalham a fila ao vivo. As mesas incluem Incident, Problem, Service Request, Change, mais um tipo de mesa Knowledge Base.",
      steps: [
        {
          title: "Crie ou abra um ticket",
          body: "Defina etapa, estado, prioridade, severidade, categoria e responsável. Os prefixos de número vêm da configuração da mesa.",
          href: "/org/ticketing",
        },
        {
          title: "Adicione notas, tarefas e anexos",
          body: "As notas capturam o trabalho; as tarefas suportam um interruptor de conclusão; os anexos carregam-se e descarregam-se na página de detalhe do ticket.",
        },
        {
          title: "Copie ou ligue tickets",
          body: "Copie um ticket quando precisar de uma via paralela; ligue tickets relacionados para manter registos de incident e problem ligados.",
        },
      ],
    },
    {
      title: "Ações em massa e preferências",
      steps: [
        {
          title: "Execute ações em massa",
          body: "Na fila, arquive em massa, desarquive, marque lido/não lido, pare notificações, elimine, funda, atualize grupo, ligue ou desbloqueie. Use o filtro arquivado para encontrar trabalho em massa fechado.",
        },
        {
          title: "Defina preferências",
          body: "Configure atraso de notificação, âmbito de notificação e mesa predefinida para que o novo trabalho chegue onde a equipa espera.",
        },
      ],
    },
    {
      title: "Mesas, SLA e procedimentos",
      body: "A administração de mesas precisa de org.ticketing.admin. Etapas, linhas de suporte, procedimentos, SLA e modelos vivem todos em Mesas.",
      steps: [
        {
          title: "Edite mesas e etapas",
          body: "Crie ou edite mesas, sequência de etapas, flags de escalamento e etapas terminais. Mantenha estados, prioridades, severidades e categorias como linhas de suporte.",
          href: "/org/ticketing/desks",
        },
        {
          title: "Anexe procedimentos",
          body: "Ligue procedimentos a eventos de criação, entrada em etapa ou escalamento para que os técnicos recebam playbooks consistentes.",
        },
        {
          title: "Defina políticas de SLA",
          body: "Defina minutos de resposta e resolução por prioridade. Os trabalhos de escalamento avançam o nível quando escalation_due_at passa.",
        },
        {
          title: "Mantenha modelos de mensagem e nota",
          body: "Reutilize modelos para respostas comuns e notas internas para manter tom e passos consistentes.",
        },
      ],
    },
    {
      title: "Ingestão de e-mail",
      steps: [
        {
          title: "Configure um leitor de e-mail",
          body: "Crie, edite ou elimine leitores em E-mail. Use test ingest para provar que uma mensagem de exemplo se torna um ticket.",
          href: "/org/ticketing/email",
        },
        {
          title: "Confie no poller IMAP",
          body: "O poller cria tickets a partir do correio de entrada. As notificações atrasadas fazem parte do mesmo pipeline—ajuste o atraso nas preferências se a equipa estiver inundada.",
        },
      ],
    },
    {
      title: "Base de conhecimento e Search All",
      steps: [
        {
          title: "Crie e publique artigos",
          body: "Crie, edite, publique/despublique ou elimine artigos KB. Rascunhos não publicados ficam fora do portal do colaborador.",
          href: "/org/ticketing/kb",
        },
        {
          title: "Converta ticket → KB",
          body: "Após resolver, converta um ticket num artigo para que a correção se torne conhecimento pesquisável.",
        },
        {
          title: "Use Search All",
          body: "Pesquise tickets e KB em conjunto a partir de /org/ticketing/search quando não tiver a certeza se a resposta é um incidente aberto ou um artigo publicado.",
          href: "/org/ticketing/search",
        },
      ],
    },
    {
      title: "Relatórios e packs",
      steps: [
        {
          title: "Descarregue resumos CSV ou PDF",
          body: "Métricas de abertos, resolvidos, violação de resposta e violação de resolução exportam-se a partir dos relatórios de ticketing.",
          href: "/org/ticketing/reports",
        },
        {
          title: "Importação/exportação JSON (admin)",
          body: "Exporte ou importe tickets selecionados como packs JSON ao migrar ou clonar dados de mesa. Requer permissão de administração de ticketing.",
        },
      ],
    },
  ],
  diagram: {
    title: "Ciclo de ticket para conhecimento",
    nodes: [
      { id: "intake", label: "E-mail / portal / agente" },
      { id: "ticket", label: "Ticket" },
      { id: "sla", label: "SLA + escalar" },
      { id: "resolve", label: "Resolver" },
      { id: "kb", label: "Artigo KB" },
      { id: "portal", label: "Portal de serviço" },
    ],
    edges: [
      { from: "intake", to: "ticket" },
      { from: "ticket", to: "sla" },
      { from: "sla", to: "resolve" },
      { from: "resolve", to: "kb" },
      { from: "kb", to: "portal" },
      { from: "portal", to: "intake", label: "novo pedido" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Mesa de Incident",
    stats: [
      { label: "Em espera", value: "5" },
      { label: "Violações", value: "0" },
      { label: "Acessos KB", value: "128" },
    ],
    highlight: {
      title: "INC-1842 · PDF de fatura suspeito",
      caption: "Etapa Em progresso · SLA 4h restantes",
      progress: 55,
    },
    rows: [
      { title: "Nota · Anexo em quarentena", meta: "Lee · 10:14" },
      { title: "Tarefa · Repor regras da caixa de correio", meta: "Aberta" },
      { title: "Converter para KB", meta: "Disponível após resolver" },
    ],
    annotations: [
      { label: "Mesas", note: "As mesas ITIL partilham padrões de etapa mas mantêm filas separadas." },
      { label: "Portal", note: "Os colaboradores submetem via /portal/tickets, não na fila da org." },
    ],
  },
  related: [
    "service-portal",
    "announcements-notifications",
    "reporting",
    "users-roles",
  ],
};
