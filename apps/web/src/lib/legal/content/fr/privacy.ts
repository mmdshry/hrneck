import type { LegalDocument } from "@/lib/legal/types";

export const privacyFr: LegalDocument = {
  slug: "privacy",
  title: "Politique de confidentialité",
  summary:
    "Comment HRneck traite les informations de santé protégées et les autres données personnelles en tant que Business Associate au sens de HIPAA, et les garanties que nous maintenons.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "scope",
      title: "Champ d’application et notre rôle",
      paragraphs: [
        "La présente Politique de confidentialité décrit la manière dont HRneck (« HRneck », « nous ») collecte, utilise, divulgue et protège les informations contenues dans le HRneck Training Portal, une plateforme de formation à la sensibilisation à la sécurité destinée aux prestataires de services managés (MSP) et aux organisations.",
        "Lorsqu’un client qui est une entité couverte ou un business associate au sens de la Health Insurance Portability and Accountability Act of 1996 et de ses textes d’application (HIPAA) utilise HRneck pour créer, recevoir, conserver ou transmettre des informations de santé protégées (PHI), HRneck agit en qualité de business associate de ce client. Le Business Associate Agreement (BAA) conclu entre HRneck et le client est le document contraignant pour les PHI. En cas de conflit entre la présente politique et un BAA concernant les PHI, le BAA prévaut.",
        "La présente politique décrit notre fonctionnement. Elle ne remplace ni le BAA, ni l’avis de pratiques de confidentialité propre au client, ni les obligations du client au titre de HIPAA.",
      ],
    },
    {
      id: "information",
      title: "Informations que nous traitons",
      paragraphs: [
        "Selon l’usage que fait le client de HRneck, nous traitons pour son compte les catégories d’informations suivantes :",
      ],
      bullets: [
        "Données du personnel et des cibles : noms, adresses e-mail professionnelles, numéros de téléphone, localisations, numéros d’employé, services et appartenance à des groupes.",
        "Données de formation : inscriptions aux cours, progression, résultats de quiz et attestations de formation.",
        "Données de simulations de hameçonnage : événements de campagne tels que la livraison, les ouvertures, les clics et les soumissions.",
        "Données du service desk : tickets, notes, pièces jointes et contenu des e-mails entrants envoyés à une boîte de ticketing configurée.",
        "Données des listes de contrôle RH : modèles, instances, réponses et fichiers téléversés.",
        "Données de compte et d’authentification : identifiants de connexion, empreintes de mots de passe, paramètres d’authentification multifacteur (MFA), identifiants de passkeys et identifiants de connexion unique.",
        "Journaux d’activité et d’audit : actions effectuées par les opérateurs et administrateurs au sein d’un tenant.",
        "Données techniques : adresses IP et journaux de requêtes nécessaires au fonctionnement, à la sécurité et au dépannage du service.",
      ],
    },
    {
      id: "phi",
      title: "Informations de santé protégées",
      paragraphs: [
        "Les dossiers d’emploi détenus par une entité couverte en sa qualité d’employeur sont exclus de la définition des PHI (45 CFR 160.103). Les données de formation du personnel et les listes de contrôle RH détenues par un client en qualité d’employeur sont généralement des dossiers d’emploi. Cette exclusion ne couvre pas les informations de santé relatives à des patients ou clients qui seraient placées dans ces dossiers.",
        "Les clients ne doivent pas saisir de PHI dans HRneck, sauf si un BAA couvre cet usage. Les tickets, les réponses aux listes de contrôle, les notes, les fichiers téléversés et les messages envoyés à l’Assistant sont des canaux de texte libre et ne doivent pas contenir de PHI, sauf si le BAA le permet.",
        "Nous n’utilisons et ne divulguons les PHI que dans les conditions permises par le BAA ou exigées par la loi (45 CFR 164.502(a)).",
      ],
    },
    {
      id: "use",
      title: "Utilisation et divulgation des informations",
      paragraphs: [
        "Nous utilisons les informations uniquement pour fournir, sécuriser, accompagner et améliorer les services HRneck pour le client, tels que décrits dans le contrat client et le BAA.",
        "Nous ne vendons pas de PHI et ne les utilisons pas à des fins de marketing ou de publicité.",
        "Nous n’utilisons ni ne divulguons de PHI d’une manière que le client ne pourrait pas faire lui-même, sauf si le BAA le permet expressément. Toute dés-identification ou analyse agrégée n’est réalisée que lorsque le BAA le permet et conformément à 45 CFR 164.514.",
        "Nous ne divulguons des PHI à des sous-traitants que dans les conditions de la section relative aux sous-traitants ci-dessous, et aux autorités publiques lorsque la loi l’exige.",
      ],
    },
    {
      id: "safeguards",
      title: "Garanties",
      paragraphs: [
        "Nous maintenons des garanties administratives, physiques et techniques qui protègent la confidentialité, l’intégrité et la disponibilité des PHI électroniques, conformément à la règle de sécurité HIPAA (45 CFR 164.302 à 164.318). Elles comprennent :",
      ],
      bullets: [
        "Contrôle d’accès : identifiants utilisateur uniques, permissions basées sur les rôles et valeurs par défaut de moindre privilège pour chaque compte opérateur (45 CFR 164.312(a)).",
        "Déconnexion automatique : les sessions expirent après une période d’inactivité. La durée de session configurée est de 120 minutes [TBD: confirm the production value].",
        "Authentification : exigences relatives aux mots de passe, mots de passe à usage unique basés sur le temps (TOTP), passkeys (WebAuthn) et codes de récupération à usage unique (45 CFR 164.312(d)).",
        "Contrôles d’audit : journaux d’activité du tenant enregistrant les actions des administrateurs et des opérateurs (45 CFR 164.312(b)). Les journaux d’activité sont purgés après 180 jours par défaut [TBD: confirm the retention setting for PHI-bearing tenants].",
        "Intégrité : accès à l’API authentifié et validation côté serveur protégeant les enregistrements contre toute altération (45 CFR 164.312(c)).",
        "Sécurité des transmissions : connexions chiffrées (TLS) pour le trafic navigateur et API (45 CFR 164.312(e)) [TBD: confirm minimum TLS version].",
        "Chiffrement : chiffrement au niveau applicatif (AES-256-CBC) des secrets stockés, tels que les identifiants de boîtes aux lettres [TBD: confirm encryption at rest for database storage and backups].",
        "Isolation des tenants : les données de chaque tenant sont stockées dans sa propre base de données.",
        "Gestion des risques : analyse des risques et traitement des risques identifiés (45 CFR 164.308(a)(1)) [TBD: confirm review cadence].",
      ],
    },
    {
      id: "incidents",
      title: "Incidents de sécurité et notification de violation",
      paragraphs: [
        "Nous suivons les incidents de sécurité affectant les PHI et documentons notre réponse. Si nous découvrons une violation de PHI non sécurisées, nous notifierons l’entité couverte concernée sans retard injustifié et au plus tard [TBD: 5 business days] après la découverte, conformément à 45 CFR 164.410. Si le BAA prévoit un délai plus court, le BAA prévaut.",
        "Dans la mesure où ces informations sont connues, la notification identifiera chaque personne dont les PHI sont concernées, décrira ce qui s’est produit et les types de PHI concernés, décrira les mesures prises et fournira un contact pour toute question. Nous tiendrons le client informé à mesure que des éléments supplémentaires seront disponibles.",
        "Les clients qui soupçonnent un incident doivent contacter immédiatement le contact confidentialité et sécurité indiqué ci-dessous.",
      ],
    },
    {
      id: "subcontractors",
      title: "Sous-traitants et sous-traitants ultérieurs",
      paragraphs: [
        "Nous exigeons que les sous-traitants qui créent, reçoivent, conservent ou transmettent des PHI pour notre compte acceptent par écrit les mêmes restrictions et conditions que celles qui nous sont applicables (45 CFR 164.502(e)(1)(ii) et 164.308(b)).",
        "[TBD: publish the subprocessor list, including hosting, database and backup, email delivery (SMTP), DNS and content delivery, and Microsoft Copilot Studio if the Assistant is enabled for a tenant.] Les clients peuvent demander la liste actuelle à tout moment.",
        "Lorsque l’Assistant est activé, les messages sont envoyés à un service conversationnel tiers (Microsoft Copilot Studio). Les clients ne doivent pas transmettre de PHI via l’Assistant, sauf si le BAA couvre ce sous-traitant ultérieur.",
      ],
    },
    {
      id: "individual_rights",
      title: "Droits des personnes",
      paragraphs: [
        "Les personnes dont les PHI sont traitées par HRneck doivent adresser leurs demandes d’accès, de modification ou de liste des divulgations à l’entité couverte qui les emploie ou leur fournit des soins. Nous aiderons l’entité couverte à répondre à ces demandes selon les exigences du BAA (45 CFR 164.524, 164.526 et 164.528).",
        "Nous mettons à la disposition du Secrétaire du ministère américain de la Santé et des Services sociaux nos pratiques internes, livres et registres relatifs aux PHI, afin de déterminer la conformité à HIPAA (45 CFR 164.504(e)(2)(ii)(I)).",
      ],
    },
    {
      id: "retention",
      title: "Conservation, restitution et destruction",
      paragraphs: [
        "Nous ne conservons les informations du client que pendant la durée nécessaire pour fournir le service, respecter nos obligations légales et exécuter le BAA.",
        "Lorsqu’un abonnement ou un BAA prend fin, nous restituerons ou détruirons l’ensemble des PHI que nous conservons, lorsque cela est réalisable (45 CFR 164.504(e)(2)(ii)(J)). Après la résiliation, le client dispose de [TBD: 30] jours pour exporter ses données avant le début de la suppression. La suppression des sauvegardes suit [TBD: backup rotation period].",
        "Si la restitution ou la destruction n’est pas réalisable, nous limiterons toute utilisation et divulgation ultérieure des PHI aux finalités qui rendent cette restitution ou destruction impossible, et nous continuerons à les protéger.",
      ],
    },
    {
      id: "cookies",
      title: "Cookies et sessions",
      paragraphs: [
        "HRneck utilise des cookies essentiels pour maintenir la connexion des utilisateurs et protéger les sessions. Nous n’utilisons pas de cookies publicitaires tiers. [TBD: confirm that no analytics or marketing cookies are loaded on the marketing pages.]",
      ],
    },
    {
      id: "changes",
      title: "Modifications de la présente politique",
      paragraphs: [
        "Nous pouvons mettre à jour cette politique de temps à autre. Pour les modifications substantielles, nous actualiserons la date d’entrée en vigueur et informerons par e-mail les clients disposant de comptes administrateur au moins [TBD: 30] jours avant leur entrée en vigueur, sauf si la loi ou le BAA exigent un délai plus court.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        "Contact confidentialité et sécurité : support@hrneck.com. [TBD: name a designated privacy officer and security officer.]",
        "HRneck, San Diego, Californie, États-Unis.",
        "Les personnes qui estiment que leurs droits en matière de confidentialité ont été violés peuvent déposer une plainte auprès de l’entité couverte ou auprès du ministère américain de la Santé et des Services sociaux, Office for Civil Rights.",
      ],
    },
  ],
};
