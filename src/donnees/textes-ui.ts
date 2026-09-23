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
    placeholder: 'La zone de combat arrive avec le canvas (bientôt, promis).',
  },

  sorts: {
    placeholder: 'Barre de sorts — tes doigts pourront s’en servir bientôt.',
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

  prestige: {
    titre: 'Prestige',
    description: 'Recommence le run, garde des Éclats — la confirmation arrive bientôt.',
    bouton: 'Prestige (bientôt)',
  },
} as const
