import type { Translation } from './en';

const fr: Translation = {
  appName: 'Xapp',
  common: {
    continue: 'Continuer',
    back: 'Retour',
    tons: '{{count}} t',
    comingSoon: 'Bientôt disponible',
  },
  welcome: {
    tagline: 'Transportez toute marchandise, partout au Maroc',
    subtitle:
      'Publiez votre chargement, recevez des offres de chauffeurs vérifiés et choisissez la meilleure.',
    chooseRole: 'Comment voulez-vous utiliser Xapp ?',
    roleClient: 'Je veux envoyer une marchandise',
    roleClientHint: 'Recevez des offres de chauffeurs pour votre chargement',
    roleDriver: 'Je suis chauffeur',
    roleDriverHint: 'Trouvez des chargements et gagnez avec votre véhicule',
    roleCompany: 'Société de transport',
    roleCompanyHint: 'Gérez votre flotte et vos chauffeurs',
  },
  language: {
    title: 'Langue',
    subtitle: "Choisissez la langue de l'application",
    device: 'Langue du téléphone',
  },
  client: {
    greeting: 'Bonjour 👋',
    whereTo: "Que voulez-vous transporter aujourd'hui ?",
    from: 'Départ',
    fromPlaceholder: 'Où se trouve la marchandise ?',
    to: 'Arrivée',
    toPlaceholder: 'Où doit-elle aller ?',
    postRequest: 'Publier une demande',
    vehicles: 'Véhicules',
    howItWorks: 'Comment ça marche',
    step1: 'Publiez votre chargement et votre trajet',
    step2: 'Les chauffeurs vous envoient des offres',
    step3: 'Choisissez la meilleure offre et suivez-la en direct',
  },
  driver: {
    greeting: 'Bienvenue, chauffeur',
    status: 'Votre compte',
    verifyTitle: 'Vérifiez votre compte',
    verifyBody:
      "Envoyez votre CIN, permis, carte grise et assurance pour commencer à recevoir des chargements.",
    verifyAction: 'Commencer la vérification',
    requestsTitle: 'Chargements près de vous',
    noRequests: 'Aucun chargement pour le moment. Les nouvelles demandes apparaîtront ici.',
    returnTrip: 'Trajet retour',
    returnTripHint: 'Indiquez votre destination et recevez des chargements sur votre route.',
  },
  company: {
    greeting: 'Bienvenue',
    fleetTitle: 'Votre flotte',
    fleetBody: 'Ajoutez vos véhicules et chauffeurs, puis attribuez les missions depuis un seul endroit.',
  },
  vehicle: {
    triporteur: 'Triporteur',
    smallVan: 'Petite fourgonnette',
    pickup: 'Pick-up',
    truck35: 'Camion 3,5 t',
    truck7: 'Camion 7 t',
    truck12: 'Camion 12 t+',
    semi: 'Semi-remorque',
    refrigerated: 'Frigorifique',
    flatbed: 'Plateau',
  },
  settings: {
    title: 'Paramètres',
    language: 'Langue',
    changeRole: 'Changer le type de compte',
  },
};

export default fr;
