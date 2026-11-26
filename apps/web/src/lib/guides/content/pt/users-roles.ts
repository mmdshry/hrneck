import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Colaboradores e funções",
  summary:
    "Gira colaboradores e as respetivas funções de acesso, crie funções personalizadas e mapeie o catálogo de permissões, incluindo os presets de ticketing.",
  keywords: ["utilizadores", "colaboradores", "funções", "rbac", "permissões", "sd_admin", "learner", "acesso"],
  openInAppHref: "/org/targets",
  overview:
    "As contas de acesso e os colaboradores formam uma única lista em Colaboradores. Cada colaborador tem um início de sessão, e a respetiva função (por exemplo learner, org_admin ou uma função personalizada) é apresentada na linha do colaborador, onde pode ser alterada. Um novo colaborador recebe por defeito a função learner para poder abrir o painel em /portal. Use Funções para compor permissões sobre formação, checklists, ticketing, relatórios, definições e anúncios. O ticketing inclui funções preset como sd_admin, sd_technician, sd_user e kb_admin. As funções do pessoal da plataforma (platform_super_admin / platform_agent) são pares entre si, não uma hierarquia acima das funções da org, e entram num tenant através do contexto MSP.",
  example: {
    title: "Função de técnico do service desk",
    narrative:
      "O administrador cria a função «SD Technician» com org.ticketing.tickets e as permissões de desk relacionadas, adiciona o lee@acme.test como colaborador com essa função e verifica que o Lee consegue triar incidentes mas não consegue alterar a marca em Definições. Uma nova contratação com a função learner por defeito abre /portal e vê os seus cursos sem qualquer acesso de operador.",
  },
  steps: [
    {
      title: "Reveja os colaboradores e as funções",
      body: "Em Colaboradores, a coluna Função mostra a função de cada início de sessão. Confirme quem já tem org_admin, learner ou funções personalizadas no tenant.",
      href: "/org/targets",
    },
    {
      title: "Abra Funções",
      body: "Reveja o catálogo de permissões e clone ou crie uma função que corresponda à tarefa.",
      href: "/org/roles",
    },
    {
      title: "Atribua os presets de ticketing com cuidado",
      body: "Use os presets sd_* / kb_admin quando a pessoa só precisar do âmbito do service desk.",
    },
    {
      title: "Adicione o colaborador com a função certa",
      body: "Adicione um colaborador em Colaboradores e escolha a função (o valor por defeito é learner). O início de sessão é criado e convidado automaticamente; para operadores, escolha uma função apenas com as permissões de que precisam.",
    },
    {
      title: "Verifique o privilégio mínimo",
      body: "Inicie sessão com esse utilizador (ou reveja as permissões) para garantir que Definições e Colaboradores continuam bloqueados para não administradores. A MFA continua disponível para todos os utilizadores da org com sessão iniciada.",
    },
  ],
  diagram: {
    title: "Modelo de acesso",
    nodes: [
      { id: "user", label: "Início de sessão (login)" },
      { id: "role", label: "Função" },
      { id: "perms", label: "Permissões" },
      { id: "modules", label: "Módulos da org" },
      { id: "target", label: "Colaborador" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "início de sessão ligado" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Colaboradores",
    stats: [
      { label: "Colaboradores", value: "9" },
      { label: "Funções personalizadas", value: "4" },
      { label: "Presets", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Tickets + desks · sem settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner" },
    ],
    annotations: [
      { label: "Catálogo", note: "As permissões são aplicadas em /api/v1/org/*." },
      { label: "Colaboradores", note: "Cada colaborador tem um início de sessão; a função define-se na lista de Colaboradores." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
