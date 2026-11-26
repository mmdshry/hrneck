import type { GuideModule } from "@/lib/guides/types";

export const gettingStartedGuide: GuideModule = {
  slug: "getting-started",
  title: "Começar",
  summary:
    "Inicie sessão como administrador da organização, conheça o shell do tenant e siga o percurso recomendado da primeira semana.",
  keywords: ["onboarding", "login", "demo", "funções", "hosts", "início"],
  openInAppHref: "/org",
  overview:
    "Os espaços de trabalho de tenant da HRneck correm em {slug}.hrneck.test (ou no alias app.hrneck.test). Os administradores da organização usam a barra lateral esquerda para gerir formação, colaboradores, checklists, ticketing, relatórios, utilizadores e definições. Os guias permanecem públicos para que possa rever os fluxos antes de iniciar sessão.",
  example: {
    title: "Primeiro login da Acme Corp",
    narrative:
      "A Sara (org_admin@acme.test) abre acme.hrneck.test, inicia sessão com a conta protegida por MFA, chega ao painel da organização e usa os Guias para confirmar o SMTP e os colaboradores antes de lançar a campanha de sensibilização do Q4.",
  },
  steps: [
    {
      title: "Abra o host do seu tenant",
      body: "Use {slug}.hrneck.test para a sua organização. Os tenants de demonstração local incluem itneck, test e company.",
    },
    {
      title: "Inicie sessão como administrador da organização",
      body: "Use uma conta org_admin como admin@{tenant}.test. A equipa da plataforma (admin@hrneck.test) usa MSP → Abrir administração do tenant, que entra num contexto real de staff do tenant antes de /org carregar.",
      href: "/login",
    },
    {
      title: "Percorra a barra lateral",
      body: "Painel, Formação, Checklists, Ticketing, Colaboradores, Departamentos, Grupos, Utilizadores, Funções, Relatórios, Anúncios e Definições mapeiam 1:1 para as capacidades do tenant.",
    },
    {
      title: "Siga o percurso inicial",
      body: "Importe colaboradores com o assistente de mapeamento CSV → verifique o SMTP → ligue packs/checklists de onboarding → atribua uma campanha de formação → abra Relatórios. Cada passo tem um guia dedicado.",
    },
    {
      title: "Convide operadores com funções",
      body: "Crie funções personalizadas com o catálogo de permissões antes de entregar trabalho a técnicos ou formadores.",
      href: "/org/roles",
    },
  ],
  diagram: {
    title: "Percurso da primeira semana do operador",
    nodes: [
      { id: "login", label: "Iniciar sessão" },
      { id: "targets", label: "Importar colaboradores" },
      { id: "smtp", label: "Verificar SMTP" },
      { id: "campaign", label: "Lançar campanha" },
      { id: "report", label: "Rever relatórios" },
    ],
    edges: [
      { from: "login", to: "targets" },
      { from: "targets", to: "smtp" },
      { from: "smtp", to: "campaign" },
      { from: "campaign", to: "report" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Checklist de início",
    stats: [
      { label: "Colaboradores", value: "0 → 186" },
      { label: "SMTP", value: "Ligado" },
      { label: "Campanhas", value: "Prontas" },
    ],
    highlight: {
      title: "Configuração da semana 1",
      caption: "3 de 4 tarefas de configuração concluídas · lançar campanha a seguir",
      progress: 75,
    },
    rows: [
      { title: "Importar colaboradores de Finanças + Ops", meta: "Concluído · CSV" },
      { title: "Confirmar SMTP mail.hrneck.com", meta: "Concluído · Integrações" },
      { title: "Criar Sensibilização de Segurança Q4", meta: "Seguinte · Campanhas" },
    ],
    annotations: [
      { label: "Barra lateral", note: "Os Guias permanecem visíveis mesmo antes de iniciar sessão." },
      { label: "Abrir na app", note: "As ligações profundas saltam para a rota ativa da organização quando autenticado." },
    ],
  },
  related: ["auth", "targets-groups", "settings", "training", "msp"],
};
