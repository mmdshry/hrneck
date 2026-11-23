import type { GuideModule } from "@/lib/guides/types";

export const targetsGroupsGuide: GuideModule = {
  slug: "targets-groups",
  title: "Colaboradores, departamentos e grupos",
  summary:
    "Construa a audiência de colaboradores com CRUD, um assistente de mapeamento CSV, departamentos, grupos e pontuações de risco.",
  keywords: [
    "colaboradores",
    "targets",
    "departamentos",
    "grupos",
    "csv",
    "audiência",
    "risco",
  ],
  openInAppHref: "/org/targets",
  overview:
    "Os colaboradores (Targets) são a audiência de formação e checklists e estão emparelhados com Utilizadores de login (tipicamente a função learner)—não são operadores da org. Gira colaboradores em Colaboradores (CRUD e assistente CSV), abra um perfil de colaborador para ver checklists ligadas, mantenha departamentos como lista gerida para formulários e organize-os em Grupos com um seletor de membros para que as campanhas possam endereçar departamentos inteiros. Arquive soft um grupo via status=inactive. Packs de checklist publicados com auto-atribuição criam instâncias quando um novo colaborador é adicionado.",
  example: {
    title: "Importação CSV de Finanças antes do Q4",
    narrative:
      "A Priya abre Importar colaboradores, carrega finance-q4.csv (186 linhas), mapeia Email Address → email e guarda um modelo de RH, pré-visualiza contagens de criar/atualizar, confirma a importação e verifica que as checklists do Welcome Pack foram auto-atribuídas no perfil de um novo colaborador.",
  },
  steps: [
    {
      title: "Abra Colaboradores",
      body: "Importe colaboradores e reveja pontuações de risco a partir do espaço de trabalho Colaboradores.",
      href: "/org/targets",
    },
    {
      title: "Gira departamentos",
      body: "Crie e mantenha departamentos na página Departamentos e selecione-os ao adicionar ou importar colaboradores.",
      href: "/org/departments",
    },
    {
      title: "Crie ou importe colaboradores",
      body: "Adicione ou edite uma pessoa com o formulário de colaborador (cargo, gestor, data de admissão, telefone, localização, tipo de emprego, idioma, fuso horário, risco). Use Importar colaboradores para um assistente: carregue qualquer CSV da empresa, mapeie colunas para campos da plataforma (e-mail obrigatório), opcionalmente guarde um modelo de mapeamento por tenant, pré-visualize erros de linha e confirme. Packs de auto-atribuição ligam checklists de onboarding e pré-preenchem função/início/gestor a partir do perfil.",
    },
    {
      title: "Abra um perfil de colaborador",
      body: "Use Abrir numa linha para rever checklists ligadas e ligar um modelo ou pack a partir do perfil.",
    },
    {
      title: "Abra Grupos",
      body: "Crie grupos de audiência separadamente da lista de colaboradores.",
      href: "/org/groups",
    },
    {
      title: "Escolha membros no modal do grupo",
      body: "Dê nome ao grupo e selecione colaboradores com o seletor de membros para que as campanhas possam visar departamentos inteiros.",
    },
  ],
  diagram: {
    title: "Fluxo de preparação da audiência",
    nodes: [
      { id: "csv", label: "CSV / CRUD" },
      { id: "depts", label: "Departamentos" },
      { id: "groups", label: "Grupos" },
      { id: "risk", label: "Pontuações de risco" },
      { id: "ready", label: "Pronto para campanha" },
    ],
    edges: [
      { from: "csv", to: "depts" },
      { from: "depts", to: "groups" },
      { from: "groups", to: "risk" },
      { from: "risk", to: "ready" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Colaboradores",
    stats: [
      { label: "Colaboradores", value: "186" },
      { label: "Departamentos", value: "6" },
      { label: "Grupos", value: "8" },
      { label: "Risco elevado", value: "2" },
    ],
    highlight: {
      title: "Departamento de Finanças",
      caption: "Importação CSV concluída · 186 colaboradores prontos",
      progress: 100,
    },
    rows: [
      { title: "alex.ng@acme.test", meta: "Finanças · Risco Elevado" },
      { title: "maya.cole@acme.test", meta: "Finanças · Risco Médio" },
      { title: "ops-all", meta: "Grupo · 64 membros" },
    ],
    annotations: [
      { label: "CSV", note: "O assistente mapeia colunas, faz dry-run de erros de linha, depois faz upsert por e-mail e cria departamentos por nome quando necessário." },
      { label: "Grupos", note: "Use o seletor de membros para que as campanhas possam visar departamentos inteiros." },
    ],
  },
  related: ["training", "checklists", "getting-started"],
};
