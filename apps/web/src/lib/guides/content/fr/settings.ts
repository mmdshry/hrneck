import type { GuideModule } from "@/lib/guides/types";

export const settingsGuide: GuideModule = {
  slug: "settings",
  title: "Paramètres et livraison",
  summary:
    "Personnalisez le tenant, imposez le MFA, confirmez SMTP, gérez les profils d'envoi et consultez le guide DNS de domaine personnalisé.",
  keywords: [
    "paramètres",
    "smtp",
    "mfa",
    "branding",
    "envoi",
    "domaine",
    "intégrations",
  ],
  openInAppHref: "/org/settings",
  overview:
    "Paramètres couvre l'affichage white-label (nom, couleur principale, logo, fuseau horaire), la configuration MFA des opérateurs, le statut d'intégration SMTP, les profils d'envoi sortant et le guide DNS de domaine d'envoi personnalisé. Confirmez le courrier avant de lancer des campagnes qui dépendent des rappels.",
  example: {
    title: "Checklist courrier pour le go-live",
    narrative:
      "Avant le lancement Q4, DevOps définit le nom d'affichage « Acme Security », la couleur principale au teal de marque, confirme qu'Intégrations affiche SMTP Connecté pour mail.hrneck.com, crée le profil d'envoi training@notify.acme.test et suit le guide DNS du stub de domaine personnalisé.",
  },
  steps: [
    {
      title: "Ouvrez Paramètres",
      body: "Mettez à jour le nom d'affichage, la couleur, le logo et le fuseau horaire du chrome du tenant.",
      href: "/org/settings",
    },
    {
      title: "Imposez le MFA",
      body: "Faites compléter la configuration MFA par les opérateurs depuis Paramètres → MFA.",
      href: "/org/settings/mfa",
    },
    {
      title: "Vérifiez SMTP",
      body: "Intégrations doit afficher Connecté avant que les rappels de campagne s'envoient de façon fiable.",
      href: "/org/settings/integrations",
    },
    {
      title: "Configurez les profils d'envoi",
      body: "Définissez les profils d'adresse d'expéditeur utilisés par le courrier de formation et de notification.",
      href: "/org/settings/sending-profiles",
    },
    {
      title: "Consultez le guide DNS du domaine",
      body: "Suivez le stub de domaine d'envoi personnalisé lorsque vous avez besoin de racines de courrier de marque.",
    },
  ],
  diagram: {
    title: "Préparation du courrier sortant",
    nodes: [
      { id: "brand", label: "Branding" },
      { id: "mfa", label: "MFA" },
      { id: "smtp", label: "Statut SMTP" },
      { id: "profile", label: "Profil d'envoi" },
      { id: "campaign", label: "Courrier de campagne" },
    ],
    edges: [
      { from: "brand", to: "smtp" },
      { from: "mfa", to: "smtp" },
      { from: "smtp", to: "profile" },
      { from: "profile", to: "campaign" },
    ],
  },
  mock: {
    chromeTitle: "Acme · Paramètres · Intégrations",
    stats: [
      { label: "SMTP", value: "Connecté" },
      { label: "MFA", value: "Obligatoire" },
      { label: "Profils", value: "2" },
    ],
    highlight: {
      title: "mail.hrneck.com",
      caption: "Dernier test OK · prêt pour les rappels de campagne",
      progress: 100,
    },
    rows: [
      {
        title: "training@notify.acme.test",
        meta: "Profil d'envoi · Par défaut",
      },
      { title: "Couleur principale", meta: "#083A6D · appliquée" },
      {
        title: "DNS de domaine personnalisé",
        meta: "Stub de guide · bascule en attente",
      },
    ],
    annotations: [
      {
        label: "Intégrations",
        note: "Le statut Connecté renforce la confiance opérationnelle.",
      },
      {
        label: "MFA",
        note: "Les opérateurs vérifient les codes sur /login/mfa ; désactivation + codes de récupération vivent sous Paramètres → MFA.",
      },
    ],
  },
  related: ["auth", "training", "getting-started", "users-roles"],
};
