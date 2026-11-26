import type { LegalDocument } from "@/lib/legal/types";

export const termsPt: LegalDocument = {
  slug: "terms",
  title: "Termos de Serviço",
  summary:
    "As regras de utilização do HRneck Training Portal, incluindo a forma como o Business Associate Agreement se aplica às informações de saúde protegidas.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "acceptance",
      title: "Aceitação destes termos",
      paragraphs: [
        "Estes Termos de Serviço («Termos») regulam o acesso e a utilização do HRneck Training Portal e dos serviços relacionados («Serviços») prestados pela HRneck («HRneck», «nós»). Ao criar uma conta, iniciar sessão ou utilizar os Serviços em nome de uma organização, concorda com estes Termos. Se os aceitar em nome de uma organização, declara ter poderes para a vincular.",
        "Se não concordar com estes Termos, não utilize os Serviços.",
      ],
    },
    {
      id: "definitions",
      title: "Definições",
      paragraphs: ["Nestes Termos:"],
      bullets: [
        "Cliente: o MSP ou organização que tem um contrato com a HRneck para os Serviços.",
        "Utilizadores: pessoas que acedem aos Serviços em nome de um Cliente, incluindo operadores, administradores, formandos e utilizadores da mesa de serviço.",
        "PHI: informações de saúde protegidas, conforme definidas em 45 CFR 160.103.",
        "BAA: um Business Associate Agreement escrito entre a HRneck e um Cliente que cumpre 45 CFR 164.504(e) e 164.308(b).",
        "Tenant: o espaço de trabalho isolado de um Cliente dentro dos Serviços.",
      ],
    },
    {
      id: "services",
      title: "Os Serviços",
      paragraphs: [
        "Os Serviços incluem formação e campanhas de sensibilização para a segurança, gestão de aprendizagem, listas de verificação de RH, gestão de serviços de TI e ticketing, relatórios e exportações, portais de formandos e de serviço, e funcionalidades opcionais de assistente de IA. As funcionalidades disponíveis para um Cliente dependem do seu plano de subscrição e das definições ativadas. [TBD: state the availability target and support hours, or reference the service level agreement.]",
      ],
    },
    {
      id: "baa",
      title: "Business Associate Agreement e ordem de precedência",
      paragraphs: [
        "Um Cliente que seja entidade abrangida ou business associate deve celebrar um BAA com a HRneck antes de criar, receber, manter ou transmitir PHI nos Serviços.",
        "O BAA rege a forma como a HRneck pode utilizar e divulgar as PHI e define as obrigações de segurança, notificação de violações, subcontratantes e devolução ou destruição. Se estes Termos e um BAA entrarem em conflito quanto às PHI, prevalece o BAA. Em todos os restantes aspetos, prevalecem estes Termos.",
      ],
    },
    {
      id: "phi_restrictions",
      title: "Restrições sobre PHI",
      paragraphs: ["Os Clientes e Utilizadores devem cumprir o seguinte:"],
      bullets: [
        "Não insira PHI nos Serviços, salvo se estiver em vigor um BAA que cubra essa utilização.",
        "Não coloque PHI em campos de texto livre, títulos ou corpos de tickets, notas de listas de verificação, ficheiros carregados, e-mails enviados para uma caixa de ticketing ou mensagens enviadas ao Assistant, salvo se o BAA o permitir expressamente.",
        "Aplique a norma do mínimo necessário. Limite as PHI ao que a finalidade exigir.",
        "Não utilize PHI reais em demonstrações, tenants de teste ou conteúdo de simulações de phishing.",
        "Se considerarmos razoavelmente que uma PHI foi colocada num canal que o BAA não cobre, podemos restringir a funcionalidade ou os dados afetados e informaremos o Cliente logo que possível.",
      ],
    },
    {
      id: "accounts",
      title: "Contas e acesso",
      paragraphs: ["Os Clientes e Utilizadores devem cumprir estas regras:"],
      bullets: [
        "Cada Utilizador deve ter uma conta individual. As credenciais não devem ser partilhadas.",
        "Os Clientes gerem os Utilizadores, funções e permissões, e devem retirar o acesso quando uma pessoa sai ou muda de função.",
        "Os Clientes devem ativar a MFA para todas as contas de administrador e de operador.",
        "É responsável pela atividade da sua conta e deve notificar-nos de imediato de qualquer suspeita de acesso não autorizado.",
      ],
    },
    {
      id: "acceptable_use",
      title: "Utilização aceitável",
      paragraphs: ["Não deve:"],
      bullets: [
        "Utilizar os Serviços para fins ilícitos ou para violar os direitos de terceiros.",
        "Tentar aceder ao tenant, aos dados ou às contas de outro Cliente, nem sondar, analisar ou testar a segurança dos Serviços sem a nossa autorização escrita.",
        "Interferir no funcionamento ou na disponibilidade dos Serviços, nomeadamente com pedidos automatizados excessivos.",
        "Executar simulações de phishing ou enviar formação apenas a pessoas que esteja autorizado a avaliar ou formar, em conformidade com as leis aplicáveis de trabalho e de comunicações.",
        "Carregar código malicioso ou conteúdos que violem a propriedade intelectual de terceiros.",
      ],
    },
    {
      id: "customer_responsibilities",
      title: "Responsabilidades do Cliente",
      paragraphs: [
        "O Cliente é responsável pela exatidão e licitude das informações que fornece; por dar os avisos e obter os consentimentos exigidos para a formação e monitorização de colaboradores; por configurar os Serviços de acordo com as suas próprias políticas de HIPAA e análise de riscos; e por formar os seus próprios Utilizadores.",
      ],
    },
    {
      id: "assistant",
      title: "Funcionalidades de assistente de IA",
      paragraphs: [
        "Quando uma organização ativa o Assistant, as mensagens dos utilizadores e o contexto relacionado de tickets ou formação podem ser tratados por um serviço conversacional de terceiros, atualmente o Microsoft Copilot Studio. As respostas do Assistant podem estar incorretas e devem ser revistas antes de serem utilizadas. Não envie PHI através do Assistant, salvo se o BAA cobrir este subprocessador. [TBD: confirm subprocessor status and BAA coverage for Microsoft Copilot Studio.]",
      ],
    },
    {
      id: "fees",
      title: "Preços, períodos de teste e subscrições",
      paragraphs: [
        "Os preços, as condições de faturação, os períodos de teste e os limites dos planos são definidos na proposta comercial, no plano de subscrição ou nos preços apresentados no registo. Podemos suspender os Serviços por falta de pagamento, após um aviso razoável [TBD: confirm notice period].",
      ],
    },
    {
      id: "intellectual_property",
      title: "Propriedade intelectual",
      paragraphs: [
        "A HRneck e os seus licenciadores são titulares dos Serviços, incluindo o software, os desenhos e a documentação. Concedemos-lhe um direito limitado, não exclusivo e intransmissível de utilizar os Serviços durante a sua subscrição. Os Clientes são proprietários dos seus dados. Concede-nos os direitos necessários para alojar e tratar esses dados a fim de prestar os Serviços.",
      ],
    },
    {
      id: "disclaimers",
      title: "Exclusões de responsabilidade",
      paragraphs: [
        "Na medida permitida pela lei, os Serviços são fornecidos «tal como estão» e «conforme disponibilidade». A formação em sensibilização para a segurança e as funcionalidades de apoio à HIPAA ajudam a reduzir o risco, mas, por si só, não tornam um Cliente conforme com a HIPAA ou com qualquer outra lei.",
      ],
    },
    {
      id: "liability",
      title: "Limitação de responsabilidade",
      paragraphs: [
        "Na máxima medida permitida pela lei, a HRneck não responde por danos indiretos, acidentais, especiais, consequenciais ou punitivos. A nossa responsabilidade total está limitada às taxas que o Cliente pagou pelos Serviços nos doze meses anteriores ao facto que deu origem à reclamação [TBD: confirm cap]. Quando um BAA estabelecer as suas próprias condições de responsabilidade quanto às PHI, essas condições aplicam-se às PHI. Nada nestes Termos limita a responsabilidade que a lei não permita limitar.",
      ],
    },
    {
      id: "termination",
      title: "Cessação",
      paragraphs: [
        "Qualquer das partes pode fazer cessar a subscrição nos termos definidos na proposta comercial ou no plano. Podemos suspender ou cessar o acesso de imediato se violar de forma grave estes Termos ou o BAA, ou se o acesso continuado criar um risco de segurança.",
        "Com o termo da subscrição, o seu acesso cessa e a HRneck devolverá ou destruirá as PHI, conforme descrito na Política de Privacidade e no BAA. As secções sobre propriedade intelectual, exclusões de responsabilidade, limitação de responsabilidade e lei aplicável sobrevivem à cessação.",
      ],
    },
    {
      id: "governing_law",
      title: "Lei aplicável e litígios",
      paragraphs: [
        "Estes Termos são regidos pelas leis do Estado da Califórnia, Estados Unidos, sem atender às suas regras de conflito de leis [TBD: confirm governing law]. Os tribunais estaduais e federais com sede no condado de San Diego, Califórnia, têm competência exclusiva, salvo se o BAA ou a proposta comercial dispuserem de outro modo.",
      ],
    },
    {
      id: "changes",
      title: "Alterações a estes Termos",
      paragraphs: [
        "Podemos atualizar estes Termos. Atualizaremos a data de entrada em vigor e notificaremos por e-mail as contas de administrador com pelo menos [TBD: 30] dias de antecedência sobre alterações materiais. A utilização continuada dos Serviços após a data de entrada em vigor implica a aceitação dos Termos atualizados.",
      ],
    },
    {
      id: "contact",
      title: "Contacto",
      paragraphs: [
        "As perguntas sobre estes Termos podem ser enviadas para support@hrneck.com. As notificações legais devem ser dirigidas à HRneck, San Diego, Califórnia, Estados Unidos. [TBD: confirm the legal entity name and notice address.]",
      ],
    },
  ],
};
