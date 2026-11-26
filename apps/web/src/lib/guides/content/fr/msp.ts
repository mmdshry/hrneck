import type { GuideModule } from "@/lib/guides/types";

export const mspGuide: GuideModule = {
  slug: "msp",
  title: "Console MSP",
  summary:
    "Parcourez les organisations tenant en tant que personnel plateforme, ouvrez un contexte d'administration de tenant et revenez au répertoire MSP.",
  keywords: [
    "msp",
    "plateforme",
    "tenant",
    "organisations",
    "personnel",
    "entrer",
    "quitter",
    "platform_super_admin",
    "platform_agent",
  ],
  openInAppHref: "/msp",
  overview:
    "La console MSP sur /msp est réservée au personnel plateforme (platform_super_admin et platform_agent). Elle liste les organisations tenant avec secteur, tranche d'effectifs, statut et indicateurs de formation, et permet Ouvrir l'administration du tenant—ce qui entre dans un vrai contexte staff_tenant_id pour charger /org pour ce client. Utilisez Quitter le tenant dans la bannière de l'environnement org pour revenir à /msp.",
  example: {
    title: "Le personnel aide Acme avant le lancement Q4",
    narrative:
      "L'agent plateforme Jordan ouvre /msp, trouve Acme (actif, 100–249 employés, formation activée), clique sur Ouvrir l'administration du tenant, arrive sur /org avec toutes les permissions, vérifie SMTP sous Paramètres, puis choisit Quitter le tenant et revient au répertoire MSP.",
  },
  steps: [
    {
      title: "Connectez-vous en tant que personnel plateforme",
      body: "Utilisez un compte plateforme tel que admin@hrneck.test. Les utilisateurs uniquement org ne peuvent pas ouvrir /msp.",
      href: "/login",
    },
    {
      title: "Ouvrez le répertoire MSP",
      body: "Examinez les tenants : nom, secteur, tranche d'effectifs (1–10 jusqu'à 500+), actif/inactif et formation on/off. Les hôtes suivent {slug}.hrneck.test.",
      href: "/msp",
    },
    {
      title: "Ouvrez l'administration du tenant",
      body: "Entrez dans le tenant sélectionné. L'app Next org se charge avec le contexte de tenant personnel et vous traite comme disposant de toutes les permissions org tant que vous y êtes.",
    },
    {
      title: "Travaillez dans /org",
      body: "Utilisez la barre latérale org normale (formation, employés, ticketing, paramètres, etc.). Les métriques en direct et les Guides se comportent comme une session org_admin.",
      href: "/org",
    },
    {
      title: "Quittez le tenant",
      body: "Utilisez le contrôle Quitter le tenant de la bannière pour effacer le contexte personnel et revenir à /msp. Changer votre mot de passe efface aussi le contexte de tenant personnel.",
    },
  ],
  sections: [
    {
      title: "MSP vs org",
      steps: [
        {
          title: "MSP = répertoire + entrée",
          body: "Next /msp est le répertoire léger du personnel et le point d'entrée dans l'UI org du client.",
        },
        {
          title: "Les utilisateurs org restent sur leur hôte",
          body: "Les comptes org_admin se connectent sur {slug}.hrneck.test et n'ont jamais besoin d'entrer/quitter MSP.",
        },
      ],
    },
  ],
  diagram: {
    title: "Contexte de tenant du personnel",
    nodes: [
      { id: "login", label: "Connexion plateforme" },
      { id: "msp", label: "Répertoire /msp" },
      { id: "enter", label: "Entrer dans le tenant" },
      { id: "org", label: "Espace /org" },
      { id: "exit", label: "Quitter le tenant" },
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
    chromeTitle: "HRneck · MSP · Organisations",
    stats: [
      { label: "Tenants", value: "3" },
      { label: "Actifs", value: "3" },
      { label: "Contexte", value: "Aucun" },
    ],
    highlight: {
      title: "Acme Corp",
      caption:
        "100–249 · formation activée · Ouvrir l'administration du tenant",
      progress: 100,
    },
    rows: [
      { title: "acme.hrneck.test", meta: "Actif · secteur Services" },
      { title: "itneck.hrneck.test", meta: "Tenant de démonstration" },
      {
        title: "Quitter le tenant",
        meta: "Affiché uniquement pendant /org",
      },
    ],
    annotations: [
      {
        label: "Entrer",
        note: "Définit staff_tenant_id avant le chargement de /org.",
      },
      {
        label: "Périmètre",
        note: "Seuls platform_super_admin / platform_agent voient /msp.",
      },
    ],
  },
  related: ["getting-started", "auth", "settings", "users-roles"],
};
