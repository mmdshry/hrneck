import type { GuideModule } from "@/lib/guides/types";

export const mspGuide: GuideModule = {
  slug: "msp",
  title: "Consola MSP",
  summary:
    "Navegue pelas organizações tenant como equipa da plataforma, abra um contexto de administração do tenant e saia de volta para o diretório MSP.",
  keywords: [
    "msp",
    "plataforma",
    "tenant",
    "organizações",
    "staff",
    "entrar",
    "sair",
    "platform_super_admin",
    "platform_agent",
  ],
  openInAppHref: "/msp",
  overview:
    "A consola MSP em /msp é só para a equipa da plataforma (platform_super_admin e platform_agent). Lista organizações tenant com indústria, faixa de colaboradores, estado e flags de formação, e permite à equipa Abrir administração do tenant—o que entra num contexto real staff_tenant_id para que /org carregue para esse cliente. Use Sair do tenant no banner do shell da org para voltar a /msp.",
  example: {
    title: "Staff ajuda a Acme antes do lançamento Q4",
    narrative:
      "O agente da plataforma Jordan abre /msp, encontra a Acme (ativa, 100–249 colaboradores, formação ligada), clica em Abrir administração do tenant, chega a /org com todas as permissões, verifica o SMTP em Definições, escolhe Sair do tenant e regressa ao diretório MSP.",
  },
  steps: [
    {
      title: "Inicie sessão como equipa da plataforma",
      body: "Use uma conta de plataforma como admin@hrneck.test. Utilizadores só da org não podem abrir /msp.",
      href: "/login",
    },
    {
      title: "Abra o diretório MSP",
      body: "Reveja tenants: nome, indústria, faixa de colaboradores (1–10 até 500+), ativo/inativo e formação ligada/desligada. Os hosts seguem {slug}.hrneck.test.",
      href: "/msp",
    },
    {
      title: "Abra a administração do tenant",
      body: "Entre no tenant selecionado. A app Next da org carrega com contexto de tenant de staff e trata-o como tendo todas as permissões da org enquanto estiver dentro.",
    },
    {
      title: "Trabalhe dentro de /org",
      body: "Use a barra lateral normal da org (formação, colaboradores, ticketing, definições, e assim por diante). Métricas em direto e Guias comportam-se como uma sessão org_admin.",
      href: "/org",
    },
    {
      title: "Saia do tenant",
      body: "Use o controlo do banner Sair do tenant para limpar o contexto de staff e voltar a /msp. Alterar a palavra-passe também limpa o contexto de tenant de staff.",
    },
  ],
  sections: [
    {
      title: "MSP vs org",
      steps: [
        {
          title: "MSP = diretório + entrar",
          body: "Next /msp é o diretório leve de staff e ponto de entrada na UI da org do cliente.",
        },
        {
          title: "Utilizadores da org ficam no seu host",
          body: "Contas org_admin iniciam sessão em {slug}.hrneck.test e nunca precisam de entrar/sair do MSP.",
        },
      ],
    },
  ],
  diagram: {
    title: "Contexto de tenant de staff",
    nodes: [
      { id: "login", label: "Login da plataforma" },
      { id: "msp", label: "Diretório /msp" },
      { id: "enter", label: "Entrar no tenant" },
      { id: "org", label: "Espaço de trabalho /org" },
      { id: "exit", label: "Sair do tenant" },
    ],
    edges: [
      { from: "login", to: "msp" },
      { from: "msp", to: "enter" },
      { from: "enter", to: "org" },
      { from: "org", to: "exit" },
      { from: "exit", to: "msp" },
    ],
  },
  mock: {
    chromeTitle: "HRNECK · MSP · Organizações",
    stats: [
      { label: "Tenants", value: "3" },
      { label: "Ativos", value: "3" },
      { label: "Contexto", value: "Nenhum" },
    ],
    highlight: {
      title: "Acme Corp",
      caption: "100–249 · formação ligada · Abrir administração do tenant",
      progress: 100,
    },
    rows: [
      { title: "acme.hrneck.test", meta: "Ativo · indústria Services" },
      { title: "itneck.hrneck.test", meta: "Tenant de demonstração" },
      { title: "Sair do tenant", meta: "Mostrado apenas enquanto está dentro de /org" },
    ],
    annotations: [
      { label: "Entrar", note: "Define staff_tenant_id antes de /org carregar." },
      { label: "Âmbito", note: "Apenas platform_super_admin / platform_agent veem /msp." },
    ],
  },
  related: ["getting-started", "auth", "settings", "users-roles"],
};
