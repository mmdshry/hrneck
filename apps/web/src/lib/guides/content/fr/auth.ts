import type { GuideModule } from "@/lib/guides/types";

export const authGuide: GuideModule = {
  slug: "auth",
  title: "Connexion, MFA et mot de passe",
  summary:
    "Connectez-vous sur le bon hôte, validez le MFA, réinitialisez un mot de passe oublié et comprenez la vérification e-mail et les codes de récupération.",
  keywords: [
    "connexion",
    "mfa",
    "mot de passe",
    "oublié",
    "réinitialiser",
    "récupération",
    "vérification",
    "session",
    "totp",
    "sso",
    "google",
    "microsoft",
    "passkey",
    "clé d'accès",
  ],
  openInAppHref: "/login",
  overview:
    "HRNECK utilise des sessions par cookie sur les hôtes tenant ({slug}.hrneck.test) et l'alias de l'app. La connexion prend en charge se souvenir de moi, un filtre de vérification e-mail (les utilisateurs créés par un admin sont généralement déjà vérifiés), Continuer avec Google ou Microsoft pour les comptes déjà créés par un administrateur, le MFA TOTP ou les clés d'accès comme second facteur avec codes de récupération à usage unique, et les flux oubli/réinitialisation/changement de mot de passe. La configuration, les clés d'accès et la désactivation du MFA se trouvent sous Paramètres → MFA pour les opérateurs connectés. Le personnel plateforme et les utilisateurs org partagent les mêmes pages de connexion mais atterrissent sur /msp ou /org selon le rôle. Changer le mot de passe efface tout contexte de tenant personnel.",
  example: {
    title: "L'admin org récupère l'accès avant le lancement",
    narrative:
      "Sara oublie son mot de passe le matin du lancement Q4, utilise /login/forgot, le réinitialise via le lien e-mail, se connecte, valide /login/mfa avec son authenticator et enregistre de nouveaux codes de récupération depuis Paramètres → MFA avant d'assigner la campagne.",
  },
  steps: [
    {
      title: "Ouvrez le bon hôte",
      body: "Les utilisateurs org utilisent {slug}.hrneck.test. Les tenants de démonstration locaux incluent itneck, test et company. Le personnel plateforme peut utiliser l'hôte central puis MSP.",
      href: "/login",
    },
    {
      title: "Connectez-vous",
      body: "Utilisez e-mail et mot de passe avec option se souvenir de moi, ou Continuer avec Google ou Microsoft lorsque ce bouton apparaît. Les e-mails non vérifiés sont bloqués jusqu'à la fin de la vérification.",
    },
    {
      title: "Validez le MFA lorsqu'il est demandé",
      body: "Sur /login/mfa, saisissez le code de votre application d'authentification, ou choisissez Se connecter avec une clé d'accès si vous en avez ajouté une. Si vous perdez les deux, utilisez un code de récupération à usage unique, puis réenregistrez le MFA.",
      href: "/login/mfa",
    },
    {
      title: "Mot de passe oublié ou réinitialisation",
      body: "Utilisez /login/forgot pour demander un e-mail de réinitialisation, puis /login/reset avec le jeton. Après un changement de mot de passe, réentrez tout tenant MSP que vous aviez ouvert.",
      href: "/login/forgot",
    },
    {
      title: "Gérez le MFA dans Paramètres",
      body: "Les opérateurs connectés configurent, confirment ou désactivent le MFA, ajoutent ou suppriment des clés d'accès et consultent les codes de récupération. Supprimer une clé d'accès demande votre mot de passe. Désactiver le MFA demande votre mot de passe et un code ou une clé d'accès, et supprime toutes les clés d'accès.",
      href: "/org/settings/mfa",
    },
  ],
  sections: [
    {
      title: "Qui atterrit où",
      steps: [
        {
          title: "Opérateurs org",
          body: "org_admin et les rôles personnalisés atterrissent dans /org sur l'hôte de leur tenant après le MFA.",
        },
        {
          title: "Personnel plateforme",
          body: "platform_super_admin / platform_agent utilisent /msp et entrent éventuellement dans un tenant. Le MFA Filament sur admin.hrneck.test ne prend en charge qu'une application d'authentification. Les clés d'accès n'y sont pas encore proposées.",
        },
        {
          title: "Apprenants et utilisateurs du portail",
          body: "Mêmes pages de connexion ; après création de session ils ouvrent /org (admins org) ou /portal (tableau de bord employé) selon leurs permissions.",
        },
      ],
    },
    {
      title: "Options de connexion",
      steps: [
        {
          title: "Google ou Microsoft (SSO)",
          body: "La page de connexion n'affiche Continuer avec Google ou Continuer avec Microsoft que si votre organisation a configuré ce fournisseur. Le SSO fonctionne uniquement pour les comptes déjà créés par un administrateur : il ne crée jamais d'utilisateur et ne relie un compte existant par e-mail que si le fournisseur confirme cette adresse. Votre fournisseur d'identité gère le MFA, donc l'invite MFA de HRNECK n'apparaît pas après le SSO. La connexion par mot de passe reste disponible à côté du SSO.",
        },
        {
          title: "Clés d'accès",
          body: "Une clé d'accès, comme celle de cet appareil ou une clé de sécurité, peut être votre second facteur sur /login/mfa, à côté de l'application d'authentification. Ajoutez des clés d'accès sous Paramètres → MFA. Le premier facteur ajouté active le MFA et affiche les codes de récupération une seule fois : conservez-les. Les clés d'accès nécessitent une connexion sécurisée (https:// ou localhost) et ne fonctionnent pas sur un domaine personnalisé de tenant.",
        },
      ],
    },
  ],
  diagram: {
    title: "Parcours d'authentification",
    nodes: [
      { id: "host", label: "Hôte du tenant" },
      { id: "login", label: "Connexion" },
      { id: "mfa", label: "Défi MFA" },
      { id: "app", label: "Org / MSP / Learn" },
      { id: "reset", label: "Oubli / réinitialisation" },
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
    chromeTitle: "Acme · Connexion",
    stats: [
      { label: "MFA", value: "Obligatoire" },
      { label: "Session", value: "Cookie" },
      { label: "Hôte", value: "acme.hrneck.test" },
    ],
    highlight: {
      title: "Défi authenticator",
      caption: "Saisissez le code à 6 chiffres ou un code de récupération",
      progress: 100,
    },
    rows: [
      { title: "/login", meta: "E-mail + mot de passe" },
      { title: "/login/mfa", meta: "TOTP · clé d'accès · codes de récupération" },
      { title: "/login/forgot", meta: "E-mail de réinitialisation" },
    ],
    annotations: [
      {
        label: "Vérification",
        note: "Les utilisateurs non vérifiés ne passent pas le filtre de connexion.",
      },
      {
        label: "Contexte personnel",
        note: "Le changement de mot de passe efface l'état d'entrée MSP.",
      },
    ],
  },
  related: ["getting-started", "msp", "settings", "learner-portal"],
};
