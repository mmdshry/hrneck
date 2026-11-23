import type { GuideModule } from "@/lib/guides/types";

export const reportingGuide: GuideModule = {
  slug: "reporting",
  title: "Relatórios e exportação PDF",
  summary:
    "Explore separadores de relatórios detalhados, agende CSV por e-mail e exporte PDFs trimestrais com arquivos.",
  keywords: ["relatórios", "pdf", "csv", "agendar", "exportar", "análise", "arquivo"],
  openInAppHref: "/org/reports",
  overview:
    "Relatórios cobre painéis de resumo mais separadores detalhados (empresa, utilizadores, targets, campanhas, formação, checklists, ticketing) com descarga CSV. Agende relatórios por e-mail mensais/semanais/trimestrais, exporte PDFs trimestrais a partir da UI de calendário e navegue pelos arquivos (podados após seis meses).",
  example: {
    title: "Pack de conselho para o Q4",
    narrative:
      "Na primeira segunda-feira de janeiro, a Mira abre Exportar, seleciona Q4, gera o pack DomPDF que cobre conclusão de formação e risco, descarrega o arquivo e confirma que o CSV trimestral agendado também foi enviado para leadership@acme.test.",
  },
  steps: [
    {
      title: "Abra Relatórios",
      body: "Reveja cartões de resumo e mude para separadores detalhados do domínio de que precisa.",
      href: "/org/reports",
    },
    {
      title: "Descarregue CSV",
      body: "Cada separador detalhado expõe uma descarga CSV para análise offline.",
    },
    {
      title: "Agende relatórios por e-mail",
      body: "Configure cadências mensais, semanais ou trimestrais para que as partes interessadas recebam CSV automaticamente.",
      href: "/org/reports",
    },
    {
      title: "Exporte PDF trimestral",
      body: "Use o calendário de exportação para gerar e descarregar arquivos DomPDF.",
      href: "/org/reports/export",
    },
    {
      title: "Verifique os arquivos",
      body: "Volte a descarregar exportações anteriores a partir da lista de arquivos; as mais antigas que seis meses são podadas.",
    },
  ],
  diagram: {
    title: "Caminhos de entrega de relatórios",
    nodes: [
      { id: "tabs", label: "Separadores de relatório" },
      { id: "csv", label: "Descarga CSV" },
      { id: "schedule", label: "Agendamento por e-mail" },
      { id: "pdf", label: "PDF trimestral" },
      { id: "archive", label: "Arquivos" },
    ],
    edges: [
      { from: "tabs", to: "csv" },
      { from: "tabs", to: "schedule" },
      { from: "tabs", to: "pdf" },
      { from: "pdf", to: "archive" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Exportação de relatório",
    stats: [
      { label: "PDF Q4", value: "Pronto" },
      { label: "Agendamentos", value: "3" },
      { label: "Arquivos", value: "5" },
    ],
    highlight: {
      title: "Pack trimestral · 2025 Q4",
      caption: "Resumo de formação + risco + checklist · 2,4 MB",
      progress: 100,
    },
    rows: [
      { title: "Conclusão de formação", meta: "CSV · Semanal para ops@" },
      { title: "Volume de ticketing", meta: "CSV · Mensal" },
      { title: "Arquivo PDF Q3", meta: "Retido · 4 meses restantes" },
    ],
    annotations: [
      { label: "Calendário", note: "Escolha um trimestre, gere e depois descarregue." },
      { label: "Stub de webhook", note: "Hooks de entrega estão preparados para automação futura." },
    ],
  },
  related: ["training", "checklists", "ticketing"],
};
