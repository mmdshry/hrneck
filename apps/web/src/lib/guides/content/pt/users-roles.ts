import type { GuideModule } from "@/lib/guides/types";

export const usersRolesGuide: GuideModule = {
  slug: "users-roles",
  title: "Utilizadores e funções",
  summary:
    "Convide operadores e formandos da org, crie funções personalizadas e mapeie o catálogo de permissões—incluindo presets de ticketing.",
  keywords: ["utilizadores", "funções", "rbac", "permissões", "sd_admin", "learner", "acesso"],
  openInAppHref: "/org/users",
  overview:
    "Os utilizadores de login da org incluem operadores (org_admin e funções personalizadas) e colaboradores. Cada Colaborador (Target) é emparelhado com um Utilizador que tipicamente tem a função learner para poder iniciar sessão em /learn e no portal de serviço. Use Utilizadores para convidar pessoas e Funções para compor permissões em formação, checklists, ticketing, relatórios, definições e anúncios. O ticketing inclui funções preset como sd_admin, sd_technician, sd_user e kb_admin. As funções de equipa da plataforma (platform_super_admin / platform_agent) são pares entre si—não uma hierarquia acima das funções da org—e entram num tenant via contexto MSP.",
  example: {
    title: "Função de técnico de service desk",
    narrative:
      "O admin cria a função “SD Technician” com org.ticketing.tickets e permissões de mesa relacionadas, convida lee@acme.test e verifica que o Lee pode fazer triagem de incidents mas não pode alterar a marca em Definições. Em separado, um novo colaborador em Colaboradores recebe um Utilizador learner emparelhado e pode abrir /learn sem aparecer como operador da org.",
  },
  steps: [
    {
      title: "Reveja os utilizadores existentes",
      body: "Confirme quem já tem org_admin, learner ou funções personalizadas no tenant.",
      href: "/org/users",
    },
    {
      title: "Abra Funções",
      body: "Inspecione o catálogo de permissões e clone ou crie uma função que corresponda ao trabalho.",
      href: "/org/roles",
    },
    {
      title: "Atribua presets de ticketing com cuidado",
      body: "Use presets sd_* / kb_admin quando a pessoa só precisa do âmbito de service desk.",
    },
    {
      title: "Convide o operador ou confie no emparelhamento do colaborador",
      body: "Crie um operador em Utilizadores com a função certa, ou adicione um Colaborador para que ProvisionEmployeePair crie o Utilizador/login learner emparelhado.",
    },
    {
      title: "Verifique o privilégio mínimo",
      body: "Inicie sessão como esse utilizador (ou reveja as permissões) para garantir que Definições e Utilizadores permanecem bloqueados para não-admins. O MFA continua disponível para todos os utilizadores da org com sessão iniciada.",
    },
  ],
  diagram: {
    title: "Modelo de acesso",
    nodes: [
      { id: "user", label: "Utilizador (login)" },
      { id: "role", label: "Função" },
      { id: "perms", label: "Permissões" },
      { id: "modules", label: "Módulos da org" },
      { id: "target", label: "Target / colaborador" },
    ],
    edges: [
      { from: "user", to: "role" },
      { from: "role", to: "perms" },
      { from: "perms", to: "modules" },
      { from: "target", to: "user", label: "learner emparelhado" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Funções",
    stats: [
      { label: "Utilizadores", value: "9" },
      { label: "Funções personalizadas", value: "4" },
      { label: "Presets", value: "sd_*" },
    ],
    highlight: {
      title: "SD Technician",
      caption: "Tickets + mesas · sem settings.manage",
      progress: 100,
    },
    rows: [
      { title: "lee@acme.test", meta: "SD Technician" },
      { title: "mira@acme.test", meta: "org_admin" },
      { title: "maya@acme.test", meta: "learner · Target emparelhado" },
    ],
    annotations: [
      { label: "Catálogo", note: "As permissões são aplicadas em /api/v1/org/*." },
      { label: "Colaboradores", note: "Os colaboradores são utilizadores de login via emparelhamento Target↔User (learner)." },
    ],
  },
  related: ["ticketing", "settings", "getting-started", "targets-groups"],
};
