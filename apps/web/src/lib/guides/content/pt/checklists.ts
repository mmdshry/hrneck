import type { GuideModule } from "@/lib/guides/types";

export const checklistsGuide: GuideModule = {
  slug: "checklists",
  title: "Checklists de RH",
  summary:
    "Desenhe modelos só para administradores com itens condicionais, versione-os em segurança, agrupe packs com auto-atribuição e audite cada alteração de resposta.",
  keywords: [
    "checklist",
    "onboarding",
    "offboarding",
    "modelo",
    "instância",
    "pack",
    "welcome pack",
    "auto-atribuição",
    "auditoria",
    "rh",
    "visible_when",
    "requires",
    "versão",
  ],
  openInAppHref: "/org/checklists",
  overview:
    "As checklists são fluxos internos de RH—não são conteúdo de formação e nunca aparecem em /learn. Os administradores desenham modelos flexíveis, copiam os cinco modelos de sistema de RH, agrupam packs (por exemplo um Welcome Pack), ligam instâncias a colaboradores e preenchem-nas como operadores. Ao guardar, escolhe se um novo esquema de modelo se aplica a instâncias abertas ou apenas a novas. Packs publicados podem auto-atribuir quando um novo colaborador é criado. Cada alteração de resposta entra no registo de atividade do tenant.",
  example: {
    title: "Welcome Pack de novo colaborador",
    narrative:
      "RH copia os modelos de sistema Onboarding e IT Access, adiciona um select “Precisa de portátil?” que revela uma checkbox de portátil via visible_when, e uma assinatura do gestor que requer MFA enrolled. Publicam um Welcome Pack com auto-atribuição. Quando alex.ng@acme.test é adicionado, ambas as instâncias aparecem no perfil do colaborador; os operadores preenchem itens e o rasto de auditoria mostra quem verificou a inscrição MFA.",
  },
  steps: [
    {
      title: "Abra Checklists",
      body: "Navegue pelos modelos personalizados e de sistema a partir do hub Checklists. Copie um modelo de sistema antes de o atribuir.",
      href: "/org/checklists",
    },
    {
      title: "Edite um modelo",
      body: "Use o construtor para tipos de item, regras visible_when e dependências requires. Guarde com a escolha aplicar-a-abertas ou apenas-novas.",
    },
    {
      title: "Construa um pack",
      body: "Agrupe modelos num Welcome Pack e opcionalmente ative a auto-atribuição na criação de colaborador.",
      href: "/org/checklists/packs",
    },
    {
      title: "Ligue e preencha",
      body: "Atribua a partir de Instâncias ou de um perfil de colaborador, complete itens como RH e reveja o histórico do registo de atividade.",
      href: "/org/checklists/instances",
    },
  ],
  sections: [
    {
      title: "Construtor de modelos",
      body: "Os modelos são definições de formulário versionadas. Os colaboradores nunca os preenchem—apenas operadores com org.checklists.manage.",
      steps: [
        {
          title: "Comece a partir de um modelo de sistema quando possível",
          body: "Cinco modelos iniciais cobrem Employee Onboarding, Employee Offboarding, IT Access Provisioning, Internal Transfer / Role Change e Leave Return. Copie antes de editar para o original de sistema permanecer intacto.",
          href: "/org/checklists",
        },
        {
          title: "Adicione tipos de item",
          body: "Tipos suportados: secção, checkbox, texto curto, texto longo, seleção única, seleção múltipla, data, número, ficheiro, ligação e nota rica.",
        },
        {
          title: "Use visible_when para condicionais",
          body: "Oculte ou mostre itens com base em respostas anteriores (por exemplo mostre “Etiqueta de ativo do portátil” apenas quando Precisa de portátil = sim).",
        },
        {
          title: "Use requires para dependências",
          body: "Bloqueie um item até outro estar completo (por exemplo a assinatura do gestor requer MFA enrolled).",
        },
        {
          title: "Abra o construtor",
          body: "Edite o esquema em /org/checklists/[id]. Mantenha as secções curtas para os operadores percorrerem rapidamente as instâncias abertas.",
        },
      ],
    },
    {
      title: "Versionamento ao guardar",
      body: "Guardar cria uma nova versão do modelo. Decide como o trabalho aberto é afetado.",
      steps: [
        {
          title: "Escolha aplicar a instâncias abertas",
          body: "Empurre o novo esquema para instâncias ainda abertas quando a alteração do processo tem de aplicar-se imediatamente.",
        },
        {
          title: "Ou escolha apenas-novas",
          body: "Deixe as instâncias abertas no esquema anterior e aplique a nova versão apenas a atribuições futuras—mais seguro a meio de uma vaga.",
        },
      ],
    },
    {
      title: "Packs e auto-atribuição",
      body: "Os packs agrupam vários modelos para uma única contratação ou evento de ciclo de vida.",
      steps: [
        {
          title: "Crie e publique um pack",
          body: "Adicione modelos, dê nome ao pack (Welcome Pack é o padrão comum) e publique quando estiver pronto.",
          href: "/org/checklists/packs",
        },
        {
          title: "Ative a auto-atribuição na contratação",
          body: "Quando ativado, criar um novo colaborador liga automaticamente as instâncias do pack. Confirme isto no perfil do colaborador após importação CSV ou adição manual.",
        },
        {
          title: "Seed do Welcome Pack",
          body: "Os tenants de demonstração podem já incluir um Welcome Pack que agrupa onboarding mais acesso IT—clone em vez de reconstruir.",
        },
      ],
    },
    {
      title: "Instâncias e auditoria",
      body: "Uma instância é uma versão de modelo ligada a um colaborador.",
      steps: [
        {
          title: "Atribua a partir de Instâncias ou do perfil do colaborador",
          body: "Ligue um modelo ou pack a partir de /org/checklists/instances ou de /org/targets/[id]. O progresso mostra-se em ambas as superfícies.",
          href: "/org/checklists/instances",
        },
        {
          title: "Preencha como RH",
          body: "Complete checkboxes, textos, selects, datas, números, ficheiros e ligações. As respostas de ficheiro carregam-se na página de detalhe da instância.",
        },
        {
          title: "Reveja o rasto de auditoria",
          body: "Cada alteração de resposta é registada no registo de atividade do tenant. Use a UI de auditoria da instância quando precisar de quem-alterou-o-quê para conformidade.",
        },
      ],
    },
  ],
  diagram: {
    title: "Fluxo de modelo, pack e colaborador",
    nodes: [
      { id: "template", label: "Versão do modelo" },
      { id: "pack", label: "Pack de checklist" },
      { id: "target", label: "Colaborador" },
      { id: "instance", label: "Instância" },
      { id: "audit", label: "Rasto de auditoria" },
    ],
    edges: [
      { from: "template", to: "pack" },
      { from: "template", to: "instance" },
      { from: "pack", to: "instance" },
      { from: "target", to: "instance" },
      { from: "instance", to: "audit" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Instâncias de checklist",
    stats: [
      { label: "Abertas", value: "11" },
      { label: "Packs", value: "1 welcome" },
      { label: "Modelos", value: "5 sistema" },
    ],
    highlight: {
      title: "Welcome Pack · alex.ng@acme.test",
      caption: "Onboarding + acesso IT ligados",
      progress: 78,
    },
    rows: [
      { title: "MFA enrolled", meta: "Checkbox · Concluído" },
      { title: "Portátil necessário?", meta: "Visível quando Precisa de portátil = sim" },
      { title: "Assinatura do gestor", meta: "Pendente · requer MFA" },
    ],
    annotations: [
      { label: "Packs", note: "O Welcome Pack pode auto-atribuir na contratação." },
      { label: "Auditoria", note: "Cada alteração de resposta é registada na BD do tenant." },
    ],
  },
  related: ["targets-groups", "users-roles", "reporting"],
};
