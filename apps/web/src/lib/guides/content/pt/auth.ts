import type { GuideModule } from "@/lib/guides/types";

export const authGuide: GuideModule = {
  slug: "auth",
  title: "Início de sessão, MFA e palavra-passe",
  summary:
    "Inicie sessão no host certo, complete o MFA, reponha uma palavra-passe esquecida e compreenda a verificação de e-mail e os códigos de recuperação.",
  keywords: [
    "login",
    "mfa",
    "palavra-passe",
    "esqueci",
    "repor",
    "recuperação",
    "verificação",
    "sessão",
    "totp",
    "sso",
    "google",
    "microsoft",
    "passkey",
    "chave de acesso",
  ],
  openInAppHref: "/login",
  overview:
    "A HRNECK usa sessões por cookie nos hosts de tenant ({slug}.hrneck.test) e no alias da app. O início de sessão suporta lembrar-me, um filtro de verificação de e-mail (utilizadores criados por admin estão tipicamente já verificados), Continuar com o Google ou a Microsoft para contas que um administrador já criou, MFA TOTP ou chaves de acesso como segundo fator com códigos de recuperação de utilização única, e fluxos de esquecer/repor/alterar palavra-passe. A configuração, as chaves de acesso e a desativação do MFA estão em Definições → MFA para operadores com sessão iniciada. A equipa da plataforma e os utilizadores da org partilham as mesmas páginas de login, mas chegam a /msp ou /org conforme a função. Alterar a palavra-passe limpa qualquer contexto de tenant de staff.",
  example: {
    title: "Administrador da org recupera o acesso antes do lançamento",
    narrative:
      "A Sara esquece a palavra-passe na manhã do lançamento do Q4, usa /login/forgot, repõe a partir da ligação do e-mail, inicia sessão, completa /login/mfa com o autenticador e guarda novos códigos de recuperação em Definições → MFA antes de atribuir a campanha.",
  },
  steps: [
    {
      title: "Abra o host correto",
      body: "Os utilizadores da org usam {slug}.hrneck.test. Os tenants de demonstração local incluem itneck, test e company. A equipa da plataforma pode usar o host central e depois o MSP.",
      href: "/login",
    },
    {
      title: "Inicie sessão",
      body: "Use e-mail e palavra-passe com lembrar-me opcional, ou Continuar com o Google ou com a Microsoft quando esse botão aparecer. E-mails não verificados são bloqueados até a verificação ser concluída.",
    },
    {
      title: "Complete o MFA quando solicitado",
      body: "Em /login/mfa, introduza o código da sua app de autenticação ou escolha Entrar com chave de acesso se tiver adicionado uma. Se perder ambas, use um código de recuperação de utilização única e volte a registar o MFA.",
      href: "/login/mfa",
    },
    {
      title: "Esquecer ou repor a palavra-passe",
      body: "Use /login/forgot para pedir um e-mail de reposição e depois /login/reset com o token. Após alterar a palavra-passe, volte a entrar em qualquer tenant MSP que tivesse aberto.",
      href: "/login/forgot",
    },
    {
      title: "Gerir o MFA nas Definições",
      body: "Operadores com sessão iniciada configuram, confirmam ou desativam o MFA, adicionam ou removem chaves de acesso e veem os códigos de recuperação. Remover uma chave de acesso pede a sua palavra-passe. Desativar o MFA pede a sua palavra-passe e um código ou uma chave de acesso, e remove todas as chaves de acesso.",
      href: "/org/settings/mfa",
    },
  ],
  sections: [
    {
      title: "Quem chega aonde",
      steps: [
        {
          title: "Operadores da org",
          body: "org_admin e funções personalizadas chegam a /org no host do tenant após o MFA.",
        },
        {
          title: "Equipa da plataforma",
          body: "platform_super_admin / platform_agent usam /msp e opcionalmente entram num tenant.",
        },
        {
          title: "Formandos e utilizadores do portal",
          body: "Mesmas páginas de login; após a criação da sessão abrem /org (administradores da org) ou /portal (painel do colaborador) conforme as permissões.",
        },
      ],
    },
    {
      title: "Opções de início de sessão",
      steps: [
        {
          title: "Google ou Microsoft (SSO)",
          body: "A página de login só mostra Continuar com o Google ou Continuar com a Microsoft quando a sua organização configurou esse fornecedor. O SSO funciona apenas com contas que um administrador já criou: nunca cria um utilizador e associa uma conta existente pelo e-mail apenas quando o fornecedor confirma esse endereço. O seu fornecedor de identidade trata do MFA, por isso o pedido de MFA do HRNECK não aparece após o SSO. O início de sessão com palavra-passe continua disponível junto ao SSO.",
        },
        {
          title: "Chaves de acesso",
          body: "Uma chave de acesso, como a deste dispositivo ou uma chave de segurança, pode ser o seu segundo fator em /login/mfa, junto da app de autenticação. Adicione chaves de acesso em Definições → MFA. O primeiro fator que adicionar ativa o MFA e mostra os códigos de recuperação uma única vez, por isso guarde-os. As chaves de acesso precisam de uma ligação segura (https:// ou localhost) e não funcionam num domínio personalizado de tenant.",
        },
      ],
    },
  ],
  diagram: {
    title: "Percurso de autenticação",
    nodes: [
      { id: "host", label: "Host do tenant" },
      { id: "login", label: "Login" },
      { id: "mfa", label: "Desafio MFA" },
      { id: "app", label: "Org / MSP / Learn" },
      { id: "reset", label: "Esquecer / repor" },
    ],
    edges: [
      { from: "host", to: "login" },
      { from: "login", to: "mfa" },
      { from: "mfa", to: "app" },
      { from: "login", to: "reset" },
      { from: "reset", to: "login" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Iniciar sessão",
    stats: [
      { label: "MFA", value: "Obrigatório" },
      { label: "Sessão", value: "Cookie" },
      { label: "Host", value: "acme.hrneck.test" },
    ],
    highlight: {
      title: "Desafio do autenticador",
      caption: "Introduza o código de 6 dígitos ou um código de recuperação",
      progress: 100,
    },
    rows: [
      { title: "/login", meta: "E-mail + palavra-passe" },
      { title: "/login/mfa", meta: "TOTP · chave de acesso · códigos de recuperação" },
      { title: "/login/forgot", meta: "E-mail de reposição" },
    ],
    annotations: [
      { label: "Verificação", note: "Utilizadores não verificados não passam pelo filtro de login." },
      { label: "Contexto de staff", note: "Alterar a palavra-passe limpa o estado de entrada MSP." },
    ],
  },
  related: ["getting-started", "msp", "settings", "learner-portal"],
};
