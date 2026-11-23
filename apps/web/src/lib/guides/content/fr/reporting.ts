import type { GuideModule } from "@/lib/guides/types";

export const reportingGuide: GuideModule = {
  slug: "reporting",
  title: "Rapports et export PDF",
  summary:
    "Explorez les onglets de rapports détaillés, planifiez l'envoi CSV par e-mail et exportez des PDF trimestriels avec archives.",
  keywords: [
    "rapports",
    "pdf",
    "csv",
    "planification",
    "export",
    "analytique",
    "archive",
  ],
  openInAppHref: "/org/reports",
  overview:
    "Rapports couvre les tableaux de synthèse plus les onglets détaillés (entreprise, utilisateurs, targets, campagnes, formation, checklists, ticketing) avec téléchargement CSV. Planifiez des rapports e-mail mensuels/hebdomadaires/trimestriels, exportez des PDF trimestriels depuis l'UI calendrier et parcourez les archives (purgées après six mois).",
  example: {
    title: "Pack conseil pour le Q4",
    narrative:
      "Le premier lundi de janvier, Mira ouvre Exporter, sélectionne Q4, génère le pack DomPDF couvrant l'achèvement de formation et le risque, télécharge l'archive et confirme que le CSV trimestriel planifié a aussi été envoyé à leadership@acme.test.",
  },
  steps: [
    {
      title: "Ouvrez Rapports",
      body: "Consultez les cartes de synthèse et passez aux onglets détaillés du domaine dont vous avez besoin.",
      href: "/org/reports",
    },
    {
      title: "Téléchargez le CSV",
      body: "Chaque onglet détaillé propose un téléchargement CSV pour l'analyse hors ligne.",
    },
    {
      title: "Planifiez les rapports par e-mail",
      body: "Configurez des cadences mensuelles, hebdomadaires ou trimestrielles pour que les parties prenantes reçoivent le CSV automatiquement.",
      href: "/org/reports",
    },
    {
      title: "Exportez le PDF trimestriel",
      body: "Utilisez le calendrier d'export pour générer et télécharger les archives DomPDF.",
      href: "/org/reports/export",
    },
    {
      title: "Consultez les archives",
      body: "Retéléchargez les exports précédents depuis la liste des archives ; ceux de plus de six mois sont purgés.",
    },
  ],
  diagram: {
    title: "Chemins de livraison des rapports",
    nodes: [
      { id: "tabs", label: "Onglets de rapport" },
      { id: "csv", label: "Téléchargement CSV" },
      { id: "schedule", label: "Planification e-mail" },
      { id: "pdf", label: "PDF trimestriel" },
      { id: "archive", label: "Archives" },
    ],
    edges: [
      { from: "tabs", to: "csv" },
      { from: "tabs", to: "schedule" },
      { from: "tabs", to: "pdf" },
      { from: "pdf", to: "archive" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Export de rapports",
    stats: [
      { label: "PDF Q4", value: "Prêt" },
      { label: "Planifications", value: "3" },
      { label: "Archives", value: "5" },
    ],
    highlight: {
      title: "Pack trimestriel · 2025 Q4",
      caption: "Formation + risque + synthèse checklists · 2,4 Mo",
      progress: 100,
    },
    rows: [
      { title: "Achèvement de formation", meta: "CSV · Hebdomadaire à ops@" },
      { title: "Volume ticketing", meta: "CSV · Mensuel" },
      { title: "Archive PDF Q3", meta: "Conservée · 4 mois restants" },
    ],
    annotations: [
      {
        label: "Calendrier",
        note: "Choisissez un trimestre, générez, puis téléchargez.",
      },
      {
        label: "Webhook stub",
        note: "Les hooks de livraison sont préparés pour une automatisation future.",
      },
    ],
  },
  related: ["training", "checklists", "ticketing"],
};
