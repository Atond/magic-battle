// Textes d'interface (T-19, spec §7). Pas une sortie du simulateur : du texte, jamais un nombre —
// `equilibrage:empreinte` ne couvre que `src/donnees/constantes.ts`, celui-ci est attesté par revue et
// par grep manuel (spec §7, note sous « Bibliothèque »).
//
// Noms de travail des écoles/sorts/améliorations/équipement/nœuds d'arbre (Feu, Glace, École 3…) :
// la vague 3 (T-24 à T-27) les remplacera par le contenu définitif sans toucher aux identifiants du
// moteur (`IdEcole`, `id` de `ParametresSort`/`ParametresAchatMultiplicatif`/`ParametresNoeudArbre`).
// Ton du guide §7 : familier, jamais grandiloquent — même sur un texte de travail.

export const TEXTES_UI = {
  titre: 'Magic Battle',

  chargement: 'La sauvegarde se réveille…',

  bandeau: {
    or: 'Or',
    renommee: 'Renommée',
    eclats: 'Éclats',
    zone: 'Zone',
  },

  onglets: {
    ecoles: 'Écoles',
    ameliorations: 'Améliorations',
    prestige: 'Prestige',
  },

  ecoles: {
    titre: 'Écoles',
    verrouillee: 'École scellée',
    verrouilleeDetail: 'Un boss de zone la révélera.',
    niveau: (niveau: number) => `Niveau ${niveau}`,
    acheter: 'Étudier',
    noms: {
      feu: 'Feu',
      glace: 'Glace',
      ecole3: 'École 3',
      ecole4: 'École 4',
      ecole5: 'École 5',
      lumiere: 'Lumière',
    } as const,
  },

  combat: {
    titre: 'Combat',
    boutonClic: 'Frapper',
    aucuneCible: 'Rien à taper pour l’instant.',
    pv: (courants: number, max: number) => `PV ${courants} / ${max}`,
    timerBoss: (secondes: number) => `Boss — ${secondes} s`,
    monstreVaincu: (nom: string) => `${nom || 'Le monstre'} est tombé.`,
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
    sousTitre: 'Payées en or.',
    acheter: 'Améliorer',
    palier: (palier: number) => `Palier ${palier}`,
    noms: {
      'amelioration-1': 'Bâton amplifié',
      'amelioration-2': 'Grimoire renforcé',
    } as const,
  },

  equipement: {
    titre: 'Équipement',
    sousTitre: 'Payé en Renommée.',
    acheter: 'Équiper',
    palier: (palier: number) => `Palier ${palier}`,
    noms: {
      'equipement-1': 'Amulette',
      'equipement-2': 'Anneau',
    } as const,
  },

  arbreEclats: {
    titre: 'Arbre d’Éclats',
    sousTitre: 'Remis à zéro à chaque Ascension.',
    acheter: 'Investir',
    rang: (rang: number) => `Rang ${rang}`,
    rangMax: 'Rang maximal atteint',
    verrouille: 'Prérequis manquant',
    noms: {
      'eclats-degats-1': 'Frappe éclatante I',
      'eclats-degats-2': 'Frappe éclatante II',
      'eclats-degats-3': 'Frappe éclatante III',
      'eclats-degats-infini': 'Frappe sans fond',
      'eclats-or-1': 'Bourse enchantée I',
      'eclats-or-2': 'Bourse enchantée II',
      'eclats-or-3': 'Bourse enchantée III',
      'eclats-zone-depart': 'Tremplin de zone',
      'eclats-cooldown-1': 'Réflexes affûtés I',
      'eclats-cooldown-2': 'Réflexes affûtés II',
    } as const,
  },

  commun: {
    annuler: 'Annuler',
    fermer: 'Fermer',
  },

  prestige: {
    titre: 'Prestige',
    description: 'Recommence le run, garde des Éclats.',
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
    resume: (or: string, duree: string) => `${duree} d’absence, ${or} or gagné.`,
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
