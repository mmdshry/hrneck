import type { LegalDocument } from "@/lib/legal/types";

export const privacyPt: LegalDocument = {
  slug: "privacy",
  title: "Política de Privacidade",
  summary:
    "Como a HRNECK trata informações de saúde protegidas e outros dados pessoais como Business Associate da HIPAA, e as salvaguardas que mantemos.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "scope",
      title: "Âmbito e o nosso papel",
      paragraphs: [
        "Esta Política de Privacidade descreve como a HRNECK («HRNECK», «nós») recolhe, utiliza, divulga e protege as informações no HRNECK Training Portal, uma plataforma de formação em sensibilização para a segurança destinada a prestadores de serviços geridos (MSP) e organizações.",
        "Quando um cliente que é entidade abrangida ou business associate ao abrigo da Health Insurance Portability and Accountability Act de 1996 e respetivos regulamentos (HIPAA) utiliza a HRNECK para criar, receber, manter ou transmitir informações de saúde protegidas (PHI), a HRNECK atua como business associate desse cliente. O Business Associate Agreement (BAA) entre a HRNECK e o cliente é o documento vinculativo para as PHI. Se esta política e um BAA entrarem em conflito quanto às PHI, prevalece o BAA.",
        "Esta política descreve a forma como operamos. Não substitui o BAA, o aviso de práticas de privacidade próprio do cliente nem as obrigações do cliente ao abrigo da HIPAA.",
      ],
    },
    {
      id: "information",
      title: "Informações que tratamos",
      paragraphs: [
        "Consoante a forma como o cliente utiliza a HRNECK, tratamos em seu nome as seguintes categorias de informações:",
      ],
      bullets: [
        "Registos de colaboradores e de alvos: nomes, e-mails profissionais, números de telefone, localizações, números de colaborador, departamentos e associações a grupos.",
        "Registos de formação: inscrições em cursos, progresso, resultados de questionários e certificações de formação.",
        "Registos de simulações de phishing: eventos de campanha, como entrega, aberturas, cliques e submissões.",
        "Registos da mesa de serviço: tickets, notas, anexos e conteúdo de e-mails recebidos enviados para uma caixa de ticketing configurada.",
        "Registos de listas de verificação de RH: modelos, instâncias, respostas e ficheiros carregados.",
        "Dados de conta e autenticação: identificadores de início de sessão, hashes de palavras-passe, definições de autenticação multifator (MFA), credenciais de passkeys e identificadores de início de sessão único.",
        "Registos de atividade e de auditoria: ações realizadas por operadores e administradores dentro de um tenant.",
        "Dados técnicos: endereços IP e registos de pedidos necessários para operar, proteger e resolver problemas do serviço.",
      ],
    },
    {
      id: "phi",
      title: "Informações de saúde protegidas",
      paragraphs: [
        "Os registos de emprego detidos por uma entidade abrangida na sua qualidade de empregador estão excluídos da definição de PHI (45 CFR 160.103). Os dados de formação de colaboradores e de listas de verificação de RH detidos por um cliente na qualidade de empregador são, em regra, registos de emprego. Esta exclusão não abrange informações de saúde de doentes ou clientes que sejam inseridas nesses registos.",
        "Os clientes não devem inserir PHI na HRNECK, salvo se um BAA cobrir essa utilização. Os tickets, as respostas das listas de verificação, as notas, os ficheiros carregados e as mensagens enviadas ao Assistant são canais de texto livre e não devem conter PHI, salvo se o BAA o permitir.",
        "Utilizamos e divulgamos PHI apenas conforme o BAA permitir ou a lei exigir (45 CFR 164.502(a)).",
      ],
    },
    {
      id: "use",
      title: "Como utilizamos e divulgamos as informações",
      paragraphs: [
        "Utilizamos as informações apenas para prestar, proteger, apoiar e melhorar os serviços da HRNECK para o cliente, conforme descrito no acordo com o cliente e no BAA.",
        "Não vendemos PHI nem a utilizamos para marketing ou publicidade.",
        "Não utilizamos nem divulgamos PHI de forma que o cliente não pudesse fazer, salvo se o BAA o permitir expressamente. Qualquer desidentificação ou análise agregada só é realizada quando o BAA o permitir e de acordo com 45 CFR 164.514.",
        "Divulgamos PHI a subcontratantes apenas nas condições da secção sobre subcontratantes abaixo, e às autoridades quando a lei o exigir.",
      ],
    },
    {
      id: "safeguards",
      title: "Salvaguardas",
      paragraphs: [
        "Mantemos salvaguardas administrativas, físicas e técnicas que protegem a confidencialidade, a integridade e a disponibilidade das PHI eletrónicas, em conformidade com a Regra de Segurança da HIPAA (45 CFR 164.302 a 164.318). Incluem:",
      ],
      bullets: [
        "Controlo de acesso: identificadores de utilizador únicos, permissões baseadas em funções e predefinições de privilégio mínimo para cada conta de operador (45 CFR 164.312(a)).",
        "Encerramento automático de sessão: as sessões expiram após um período de inatividade. A duração de sessão configurada é de 120 minutos [TBD: confirm the production value].",
        "Autenticação: requisitos de palavra-passe, palavras-passe de utilização única baseadas no tempo (TOTP), passkeys (WebAuthn) e códigos de recuperação de utilização única (45 CFR 164.312(d)).",
        "Controlos de auditoria: registos de atividade do tenant que documentam as ações de administradores e operadores (45 CFR 164.312(b)). Os registos de atividade são eliminados após 180 dias por predefinição [TBD: confirm the retention setting for PHI-bearing tenants].",
        "Integridade: acesso à API autenticado e validação no servidor que protegem os registos contra alterações indevidas (45 CFR 164.312(c)).",
        "Segurança da transmissão: ligações cifradas (TLS) para o tráfego do navegador e da API (45 CFR 164.312(e)) [TBD: confirm minimum TLS version].",
        "Cifragem: cifragem ao nível da aplicação (AES-256-CBC) de segredos armazenados, como credenciais de caixas de correio [TBD: confirm encryption at rest for database storage and backups].",
        "Isolamento de tenants: os dados de cada tenant são armazenados na sua própria base de dados.",
        "Gestão de riscos: análise de riscos e tratamento dos riscos identificados (45 CFR 164.308(a)(1)) [TBD: confirm review cadence].",
      ],
    },
    {
      id: "incidents",
      title: "Incidentes de segurança e notificação de violações",
      paragraphs: [
        "Registamos os incidentes de segurança que afetam as PHI e documentamos a nossa resposta. Se descobrirmos uma violação de PHI não protegidas, notificaremos a entidade abrangida afetada sem demora injustificada e, em nenhum caso, mais tarde do que [TBD: 5 business days] após a descoberta, conforme 45 CFR 164.410. Se o BAA fixar um prazo mais curto, prevalece o BAA.",
        "Na medida em que for conhecida, a notificação identificará cada pessoa cujas PHI tenham sido envolvidas, descreverá o que aconteceu e os tipos de PHI envolvidas, descreverá as medidas tomadas e indicará um contacto para perguntas. Manteremos o cliente atualizado à medida que surgirem mais informações.",
        "Os clientes que suspeitem de um incidente devem contactar de imediato o contacto de privacidade e segurança indicado abaixo.",
      ],
    },
    {
      id: "subcontractors",
      title: "Subcontratantes e subprocessadores",
      paragraphs: [
        "Exigimos que os subcontratantes que criem, recebam, mantenham ou transmitam PHI em nosso nome concordem por escrito com as mesmas restrições e condições que nos são aplicáveis (45 CFR 164.502(e)(1)(ii) e 164.308(b)).",
        "[TBD: publish the subprocessor list, including hosting, database and backup, email delivery (SMTP), DNS and content delivery, and Microsoft Copilot Studio if the Assistant is enabled for a tenant.] Os clientes podem solicitar a lista atual a qualquer momento.",
        "Quando o Assistant está ativado, as mensagens são enviadas para um serviço conversacional de terceiros (Microsoft Copilot Studio). Os clientes não devem enviar PHI através do Assistant, salvo se o BAA cobrir este subprocessador.",
      ],
    },
    {
      id: "individual_rights",
      title: "Direitos dos titulares",
      paragraphs: [
        "As pessoas cujas PHI são tratadas através da HRNECK devem dirigir os pedidos de acesso, retificação ou lista de divulgações à entidade abrangida que as emprega ou lhes presta cuidados. Ajudaremos a entidade abrangida a responder a estes pedidos conforme exigido pelo BAA (45 CFR 164.524, 164.526 e 164.528).",
        "Disponibilizamos ao Secretário do Departamento de Saúde e Serviços Humanos dos EUA as nossas práticas internas, livros e registos relativos a PHI, para efeitos de verificação da conformidade com a HIPAA (45 CFR 164.504(e)(2)(ii)(I)).",
      ],
    },
    {
      id: "retention",
      title: "Retenção, devolução e destruição",
      paragraphs: [
        "Conservamos as informações do cliente apenas durante o tempo necessário para prestar o serviço, cumprir obrigações legais e executar o BAA.",
        "Quando uma subscrição ou um BAA termina, devolveremos ou destruiremos todas as PHI que mantemos, sempre que for exequível (45 CFR 164.504(e)(2)(ii)(J)). Após a cessação, o cliente tem [TBD: 30] dias para exportar os seus dados antes de começar a eliminação. A eliminação de cópias de segurança segue [TBD: backup rotation period].",
        "Se a devolução ou a destruição não for exequível, limitaremos qualquer utilização ou divulgação posterior das PHI às finalidades que tornam essa devolução ou destruição inexequível, e continuaremos a protegê-las.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies e sessões",
      paragraphs: [
        "A HRNECK utiliza cookies essenciais para manter os utilizadores autenticados e proteger as sessões. Não utilizamos cookies publicitários de terceiros. [TBD: confirm that no analytics or marketing cookies are loaded on the marketing pages.]",
      ],
    },
    {
      id: "changes",
      title: "Alterações a esta política",
      paragraphs: [
        "Podemos atualizar esta política periodicamente. Para alterações materiais, atualizaremos a data de entrada em vigor e notificaremos por e-mail os clientes com contas de administrador com pelo menos [TBD: 30] dias de antecedência, salvo se a lei ou o BAA exigirem um prazo menor.",
      ],
    },
    {
      id: "contact",
      title: "Contacto",
      paragraphs: [
        "Contacto de privacidade e segurança: support@hrneck.com. [TBD: name a designated privacy officer and security officer.]",
        "HRNECK, San Diego, Califórnia, Estados Unidos.",
        "As pessoas que considerem que os seus direitos de privacidade foram violados podem apresentar uma reclamação à entidade abrangida ou ao Departamento de Saúde e Serviços Humanos dos EUA, Office for Civil Rights.",
      ],
    },
  ],
};
