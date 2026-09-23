// Textes d'interface (T-19, spec §7). Pas une sortie du simulateur : du texte, jamais un nombre —
// `equilibrage:empreinte` ne couvre que `src/donnees/constantes.ts`, celui-ci est attesté par revue et
// par grep manuel (spec §7, note sous « Bibliothèque »).
//
// Les noms et descriptions de contenu (écoles, sorts, zones, quêtes, arbres, fin) ne sont pas ici : ils
// vivent à côté de leurs nombres, dans `ecoles.ts`, `sorts.ts`, `zones.ts`, `quetes.ts`, `arbres.ts`,
// `ameliorations.ts`, `equipement.ts` et `fin.ts` (vague 3). Ce fichier ne garde que le texte de
// l'interface elle-même. Ton du guide §7 : familier, clair d'abord, jamais grandiloquent.

export const TEXTES_UI = {
  titre: 'Magic Battle',

  chargement: 'La sauvegarde se réveille…',

  bandeau: {
    or: 'Or',
    renommee: 'Renommée',
    eclats: 'Éclats',
    zone: 'Zone',
    region: 'Région',
  },

  onglets: {
    ecoles: 'Écoles',
    ameliorations: 'Améliorations',
    prestige: 'Prestige',
  },

  ecoles: {
    titre: 'Écoles',
    verrouillee: 'École scellée',
    verrouilleeDetail: 'Un boss la garde sous clé. Tape-le, elle est à toi.',
    niveau: (niveau: number) => `Niveau ${niveau}`,
    acheter: 'Étudier',
  },

  combat: {
    titre: 'Combat',
    boutonClic: 'Frapper',
    aucuneCible: 'Rien à taper pour l’instant.',
    // §8 « Notation » — `courants`/`max` sont déjà passés formatés (`src/domain/notation.ts`) par
    // l'appelant : cette fonction ne fait QUE composer le texte, jamais interpoler un nombre brut (un
    // `pvMax` de formule est un flottant, jamais un entier — l'afficher tel quel a déjà produit
    // « PV 8 / 26.600198804687487 » en jeu réel).
    pv: (courants: string, max: string) => `PV ${courants} / ${max}`,
    timerBoss: (secondes: number) => `Boss — ${secondes} s`,
    monstreVaincu: (nom: string) => `${nom || 'Le monstre'} mord la poussière.`,
    bossEnApproche: (nom: string) => `${nom || 'Un boss'} entre en scène.`,
    interrupteurPerformance: 'Effets visuels de combat',
    performanceActivee: 'Effets réduits',
    performanceDesactivee: 'Effets complets',
  },

  sorts: {
    titre: 'Sorts actifs',
    touche: (touche: number) => `Touche ${touche}`,
    verrouille: 'Sort verrouillé',
    verrouilleDetail: 'Débloque son école pour t’en servir.',
    enCooldown: (secondes: number) => `Encore ${secondes} s`,
    pret: 'Prêt',
  },

  ameliorations: {
    titre: 'Améliorations',
    sousTitre: 'Payées en or, celui qui bosse même quand tu dors.',
    acheter: 'Améliorer',
    palier: (palier: number) => `Palier ${palier}`,
  },

  equipement: {
    titre: 'Équipement',
    sousTitre: 'Payé en Renommée. La gloire, ça se dépense aussi.',
    acheter: 'Équiper',
    palier: (palier: number) => `Palier ${palier}`,
  },

  arbreEclats: {
    titre: 'Arbre d’Éclats',
    sousTitre: 'Remis à zéro à chaque Ascension. Profites-en tant que ça dure.',
    acheter: 'Investir',
    rang: (rang: number) => `Rang ${rang}`,
    rangMax: 'Rang maximal atteint',
    verrouille: 'Prérequis manquant',
  },

  quetes: {
    titre: 'Quêtes',
    sousTitre: 'Chacune paie sa Renommée une fois. Pas deux, on a vérifié.',
    objectifZone: (zone: string) => `Objectif : atteindre la zone ${zone}`,
    objectifMonstres: (nombre: string) => `Objectif : ${nombre} monstres au tapis`,
    objectifPremierPrestige: 'Objectif : un premier prestige',
    recompense: (renommee: string) => `+${renommee} Renommée`,
    accomplie: 'Accomplie',
    pasEncore: 'Pas encore',
  },

  narration: {
    // Préfixe lu par les lecteurs d'écran seulement : l'encart s'annonce comme un bout d'histoire, pas
    // comme une erreur ou un résumé chiffré.
    etiquette: 'Histoire',
  },

  fin: {
    // Le titre et les lignes de l'écran de fin viennent de `TEXTES_FIN` (`fin.ts`) ; ici, les libellés
    // des statistiques et le bouton.
    statistiques: 'Ta partie en chiffres',
    duree: 'Temps de jeu',
    zoneMax: 'Zone la plus lointaine',
    ascensions: 'Ascensions',
    prestiges: 'Prestiges',
    continuer: 'Retourner voir l’or tomber',
  },

  stockagePlein: {
    message:
      'Ta progression n’est plus sauvegardée : le navigateur refuse d’en stocker davantage. Exporte ta sauvegarde pour ne rien perdre.',
  },

  // Durées affichées (encart hors-ligne, écran de fin) : les nombres arrivent déjà arrondis.
  duree: {
    minutes: (minutes: number) => `${minutes} min`,
    heures: (heures: number) => `${heures} h`,
    heuresMinutes: (heures: number, minutes: number) => `${heures} h ${minutes} min`,
  },

  commun: {
    annuler: 'Annuler',
    fermer: 'Fermer',
  },

  prestige: {
    titre: 'Prestige',
    description: 'Recommence le run, garde des Éclats. Oui, c’est voulu.',
    bouton: 'Prestiger',
    boutonVerrouille: 'Partie terminée',
    etape1Titre: 'Recommencer le run ?',
    etape1Intro: (zone: number) => `Zone atteinte : ${zone}. Le run repart de zéro, mais rien n’est perdu pour de bon.`,
    etape1Perte: (or: string, niveaux: number) => `Tu laisses ${or} or et ${niveaux} niveau${niveaux > 1 ? 'x' : ''} d’écoles derrière toi.`,
    etape1Continuer: 'Continuer',
    etape2Titre: 'Confirme le prestige',
    etape2Gain: (eclats: string) => `Tu empoches ${eclats} Éclat en échange.`,
    etape2GainPluriel: (eclats: string) => `Tu empoches ${eclats} Éclats en échange.`,
    confirmer: 'Confirmer le prestige',
  },

  ascension: {
    titre: 'Ascension',
    description: 'Efface le cycle d’Éclats, débloque l’arbre permanent.',
    bouton: 'Ascensionner',
    boutonVerrouille: 'Pas encore',
    boutonPartieTerminee: 'Partie terminée',
    progression: (fait: number, requis: number) => `${fait} / ${requis} prestiges de ce cycle`,
    etape1Titre: 'Ascensionner ?',
    etape1Intro: 'Le cycle d’Éclats repart à zéro — compteurs et arbre d’Éclats compris. L’arbre d’Ascension, lui, reste acquis.',
    etape1Perte: (or: string, niveaux: number) => `Le run en cours te laisse ${or} or et ${niveaux} niveau${niveaux > 1 ? 'x' : ''} d’écoles derrière toi.`,
    etape1Continuer: 'Continuer',
    etape2Titre: 'Confirme l’Ascension',
    etape2Gain: (points: string) => `Tu gagnes ${points} Point d’Ascension.`,
    etape2GainPluriel: (points: string) => `Tu gagnes ${points} Points d’Ascension.`,
    etape2Ecole: 'Ça révèle aussi une 6ᵉ école.',
    confirmer: 'Confirmer l’Ascension',
  },

  lectureSeule: {
    ongletSecondaire: 'Un autre onglet joue déjà cette partie — celui-ci se contente de regarder.',
    verrouPerdu: 'Un autre onglet a repris la main sur cette partie. Ferme celui-ci ou rouvre-le pour relire la partie à jour.',
  },

  horsLigne: {
    titre: 'Pendant ton absence',
    resume: (or: string, duree: string) => `${duree} d’absence, ${or} or gagné. Lui au moins, il bosse.`,
    plafond: (or: string, duree: string) => `Absence plafonnée à ${duree} — ${or} or gagné, le reste n’a pas compté.`,
  },

  illisible: {
    titre: 'Sauvegarde illisible',
    message: 'Cette sauvegarde ne se relit pas correctement. Rien n’a été effacé : choisis quoi faire.',
    detailLabel: 'Détail technique',
    restaurer: 'Restaurer la sauvegarde de secours',
    nouvellePartie: 'Nouvelle partie',
    confirmationTitre: 'Repartir de zéro ?',
    confirmationCorps: 'La sauvegarde illisible restera intacte tant que tu ne confirmes pas — c’est ce nouveau départ qui prend sa place.',
    confirmer: 'Confirmer la nouvelle partie',
  },
} as const
