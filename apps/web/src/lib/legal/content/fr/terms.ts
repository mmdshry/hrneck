import type { LegalDocument } from "@/lib/legal/types";

export const termsFr: LegalDocument = {
  slug: "terms",
  title: "Conditions d’utilisation",
  summary:
    "Les règles d’utilisation du HRNECK Training Portal, y compris l’application du Business Associate Agreement aux informations de santé protégées.",
  effectiveDate: "2026-11-26",
  sections: [
    {
      id: "acceptance",
      title: "Acceptation des présentes conditions",
      paragraphs: [
        "Les présentes Conditions d’utilisation (les « Conditions ») régissent l’accès au HRNECK Training Portal et à ses services associés (les « Services ») fournis par HRNECK (« HRNECK », « nous »), ainsi que leur utilisation. En créant un compte, en vous connectant ou en utilisant les Services au nom d’une organisation, vous acceptez les présentes Conditions. Si vous les acceptez au nom d’une organisation, vous déclarez être habilité à engager cette organisation.",
        "Si vous n’acceptez pas les présentes Conditions, n’utilisez pas les Services.",
      ],
    },
    {
      id: "definitions",
      title: "Définitions",
      paragraphs: ["Dans les présentes Conditions :"],
      bullets: [
        "Client : le MSP ou l’organisation qui a conclu un contrat avec HRNECK pour les Services.",
        "Utilisateurs : les personnes qui accèdent aux Services pour le compte d’un Client, y compris les opérateurs, administrateurs, apprenants et utilisateurs du service desk.",
        "PHI : informations de santé protégées telles que définies à 45 CFR 160.103.",
        "BAA : un Business Associate Agreement écrit entre HRNECK et un Client, conforme à 45 CFR 164.504(e) et 164.308(b).",
        "Tenant : l’espace de travail isolé d’un Client au sein des Services.",
      ],
    },
    {
      id: "services",
      title: "Les Services",
      paragraphs: [
        "Les Services comprennent la formation et les campagnes de sensibilisation à la sécurité, la gestion de l’apprentissage, les listes de contrôle RH, la gestion des services informatiques et le ticketing, les rapports et exports, les portails apprenants et service, ainsi que des fonctions facultatives d’assistant IA. Les fonctions disponibles pour un Client dépendent de son forfait d’abonnement et des paramètres activés. [TBD: state the availability target and support hours, or reference the service level agreement.]",
      ],
    },
    {
      id: "baa",
      title: "Business Associate Agreement et ordre de priorité",
      paragraphs: [
        "Un Client qui est une entité couverte ou un business associate doit conclure un BAA avec HRNECK avant de créer, recevoir, conserver ou transmettre des PHI dans les Services.",
        "Le BAA définit la manière dont HRNECK peut utiliser et divulguer les PHI et fixe les obligations de sécurité, de notification de violation, de sous-traitance, ainsi que de restitution ou destruction. En cas de conflit entre les présentes Conditions et un BAA concernant les PHI, le BAA prévaut. À tous autres égards, les présentes Conditions s’appliquent.",
      ],
    },
    {
      id: "phi_restrictions",
      title: "Restrictions relatives aux PHI",
      paragraphs: ["Les Clients et Utilisateurs doivent respecter les règles suivantes :"],
      bullets: [
        "Ne saisissez pas de PHI dans les Services, sauf si un BAA couvrant cet usage est en vigueur.",
        "Ne placez pas de PHI dans les champs de texte libre, les titres ou corps de tickets, les notes des listes de contrôle, les fichiers téléversés, les e-mails envoyés à une boîte de ticketing ou les messages envoyés à l’Assistant, sauf si le BAA le permet expressément.",
        "Appliquez la norme du minimum nécessaire. Limitez les PHI à ce que la finalité exige.",
        "N’utilisez pas de PHI réelles dans les démonstrations, les tenants de test ni le contenu des simulations de hameçonnage.",
        "Si nous estimons raisonnablement qu’une PHI a été placée dans un canal que le BAA ne couvre pas, nous pouvons restreindre la fonction ou les données concernées et en informerons le Client dans les meilleurs délais.",
      ],
    },
    {
      id: "accounts",
      title: "Comptes et accès",
      paragraphs: ["Les Clients et Utilisateurs doivent respecter les règles suivantes :"],
      bullets: [
        "Chaque Utilisateur doit disposer d’un compte individuel. Les identifiants ne doivent pas être partagés.",
        "Les Clients gèrent les Utilisateurs, les rôles et les permissions, et doivent retirer les accès lorsqu’une personne quitte l’organisation ou change de fonction.",
        "Les Clients doivent activer la MFA pour tous les comptes administrateur et opérateur.",
        "Vous êtes responsable de l’activité de votre compte et devez nous signaler sans délai tout accès non autorisé présumé.",
      ],
    },
    {
      id: "acceptable_use",
      title: "Utilisation acceptable",
      paragraphs: ["Vous ne devez pas :"],
      bullets: [
        "Utiliser les Services à des fins illicites ou pour porter atteinte aux droits d’autrui.",
        "Tenter d’accéder au tenant, aux données ou aux comptes d’un autre Client, ni sonder, scanner ou tester la sécurité des Services sans notre autorisation écrite.",
        "Perturber le fonctionnement ou la disponibilité des Services, notamment par des requêtes automatisées excessives.",
        "Exécuter des simulations de hameçonnage ou envoyer des formations uniquement à des personnes que vous êtes autorisé à évaluer ou à former, dans le respect des lois applicables en matière d’emploi et de communication.",
        "Téléverser du code malveillant ou des contenus portant atteinte à la propriété intellectuelle de tiers.",
      ],
    },
    {
      id: "customer_responsibilities",
      title: "Responsabilités du Client",
      paragraphs: [
        "Le Client est responsable de l’exactitude et de la licéité des informations qu’il fournit ; de l’information et des consentements requis pour la formation et la surveillance des salariés ; de la configuration des Services conformément à ses propres politiques HIPAA et à son analyse des risques ; et de la formation de ses propres Utilisateurs.",
      ],
    },
    {
      id: "assistant",
      title: "Fonctions d’assistant IA",
      paragraphs: [
        "Lorsqu’une organisation active l’Assistant, les messages des utilisateurs ainsi que le contexte associé des tickets ou de la formation peuvent être traités par un service conversationnel tiers, actuellement Microsoft Copilot Studio. Les réponses de l’Assistant peuvent être inexactes et doivent être vérifiées avant toute utilisation. Ne transmettez pas de PHI via l’Assistant, sauf si le BAA couvre ce sous-traitant ultérieur. [TBD: confirm subprocessor status and BAA coverage for Microsoft Copilot Studio.]",
      ],
    },
    {
      id: "fees",
      title: "Tarifs, essais et abonnements",
      paragraphs: [
        "Les tarifs, les conditions de facturation, les périodes d’essai et les limites des forfaits sont définis dans le bon de commande, le forfait d’abonnement ou les tarifs affichés lors de l’inscription. Nous pouvons suspendre les Services en cas de non-paiement, après un préavis raisonnable [TBD: confirm notice period].",
      ],
    },
    {
      id: "intellectual_property",
      title: "Propriété intellectuelle",
      paragraphs: [
        "HRNECK et ses concédants détiennent les droits sur les Services, y compris les logiciels, les créations graphiques et la documentation. Nous vous accordons un droit limité, non exclusif et non cessible d’utiliser les Services pendant la durée de votre abonnement. Les Clients sont propriétaires de leurs données. Vous nous accordez les droits nécessaires pour héberger et traiter ces données afin de fournir les Services.",
      ],
    },
    {
      id: "disclaimers",
      title: "Clauses de non-responsabilité",
      paragraphs: [
        "Dans la mesure permise par la loi, les Services sont fournis « en l’état » et « selon disponibilité ». La formation à la sensibilisation à la sécurité et les fonctions d’appui à HIPAA contribuent à réduire les risques, mais elles ne rendent pas à elles seules un Client conforme à HIPAA ou à toute autre loi.",
      ],
    },
    {
      id: "liability",
      title: "Limitation de responsabilité",
      paragraphs: [
        "Dans toute la mesure permise par la loi, HRNECK n’est pas responsable des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs. Notre responsabilité totale est limitée aux frais payés par le Client pour les Services au cours des douze mois précédant le fait générateur de la réclamation [TBD: confirm cap]. Lorsqu’un BAA prévoit ses propres conditions de responsabilité pour les PHI, ces conditions s’appliquent aux PHI. Rien dans les présentes Conditions ne limite une responsabilité qui ne peut pas être limitée par la loi.",
      ],
    },
    {
      id: "termination",
      title: "Résiliation",
      paragraphs: [
        "Chaque partie peut résilier l’abonnement dans les conditions définies dans le bon de commande ou le forfait. Nous pouvons suspendre ou résilier l’accès immédiatement en cas de manquement grave aux présentes Conditions ou au BAA, ou si la poursuite de l’accès présente un risque pour la sécurité.",
        "À la fin de l’abonnement, votre accès prend fin et HRNECK restitue ou détruit les PHI selon les modalités décrites dans la Politique de confidentialité et le BAA. Les sections relatives à la propriété intellectuelle, aux clauses de non-responsabilité, à la limitation de responsabilité et au droit applicable survivent à la résiliation.",
      ],
    },
    {
      id: "governing_law",
      title: "Droit applicable et litiges",
      paragraphs: [
        "Les présentes Conditions sont régies par les lois de l’État de Californie, États-Unis, sans égard à ses règles de conflit de lois [TBD: confirm governing law]. Les tribunaux étatiques et fédéraux situés dans le comté de San Diego, Californie, ont compétence exclusive, sauf si le BAA ou le bon de commande en dispose autrement.",
      ],
    },
    {
      id: "changes",
      title: "Modifications des présentes Conditions",
      paragraphs: [
        "Nous pouvons mettre à jour les présentes Conditions. Nous actualiserons la date d’entrée en vigueur et informerons par e-mail les comptes administrateur au moins [TBD: 30] jours avant l’entrée en vigueur de modifications substantielles. La poursuite de l’utilisation des Services après la date d’entrée en vigueur vaut acceptation des Conditions mises à jour.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        "Les questions relatives aux présentes Conditions peuvent être envoyées à support@hrneck.com. Les notifications juridiques doivent être adressées à HRNECK, San Diego, Californie, États-Unis. [TBD: confirm the legal entity name and notice address.]",
      ],
    },
  ],
};
