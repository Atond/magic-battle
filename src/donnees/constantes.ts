// Constantes d'équilibrage du jeu — **sortie du simulateur**, pas une saisie manuelle (ADR-10).
//
// Provenance : tools/idle-balance/rapports/2026-09-21.md (2026-09-21), produit par `npm run equilibrage:search`.
// Toute modification passe par une nouvelle exécution du simulateur et un nouveau rapport ; la
// commande `npm run equilibrage:check` rejoue ce fichier contre les contraintes §8 de la spec et
// échoue si l'une d'elles est ratée.
//
// Mesures retenues, résumées (détail et méthode dans le rapport) :
//   · 1er prestige 2.77 h · jeu cumulé 72.3 h · 24 prestiges en 4 Ascensions
//   · mur le plus long avant le 1er prestige 30 min · zone max 118
//   · plus grande valeur de jeu 5.22e+173 (marge 126 décades sous 1e300)
//   · contraintes §8 : 13/13 tenues

import type { Constantes } from '../domain/types.ts'

/** §8 — l'ensemble des valeurs d'équilibrage passées au moteur pur. */
export const CONSTANTES: Constantes = {
  tick: {
    nTicksMax: 600,
  },
  horsLigne: {
    plafondHeures: 10,
  },
  ecoles: {
    feu: {
      coutBase: 10,
      croissance: 1.15,
      productionBase: 0.5,
      paliersSeuils: [10, 25, 50, 100],
      multiplicateurParPalier: 2,
      zoneRevelation: null,
      requiertAscension: false,
    },
    glace: {
      coutBase: 130,
      croissance: 1.16,
      productionBase: 2,
      paliersSeuils: [10, 25, 50, 100],
      multiplicateurParPalier: 2,
      zoneRevelation: 2,
      requiertAscension: false,
    },
    ecole3: {
      coutBase: 1690,
      croissance: 1.17,
      productionBase: 8,
      paliersSeuils: [10, 25, 50, 100],
      multiplicateurParPalier: 2,
      zoneRevelation: 4,
      requiertAscension: false,
    },
    ecole4: {
      coutBase: 21970,
      croissance: 1.18,
      productionBase: 32,
      paliersSeuils: [10, 25, 50, 100],
      multiplicateurParPalier: 2,
      zoneRevelation: 6,
      requiertAscension: false,
    },
    ecole5: {
      coutBase: 285610,
      croissance: 1.19,
      productionBase: 128,
      paliersSeuils: [10, 25, 50, 100],
      multiplicateurParPalier: 2,
      zoneRevelation: 8,
      requiertAscension: false,
    },
    lumiere: {
      coutBase: 3712930,
      croissance: 1.2,
      productionBase: 512,
      paliersSeuils: [10, 25, 50, 100],
      multiplicateurParPalier: 2,
      zoneRevelation: null,
      requiertAscension: true,
    },
  },
  sorts: [
    {
      id: 'sort-feu',
      idEcole: 'feu',
      touche: 1,
      degatsBase: 10,
      cooldownMs: 3000,
    },
    {
      id: 'sort-glace',
      idEcole: 'glace',
      touche: 2,
      degatsBase: 40,
      cooldownMs: 4350,
    },
    {
      id: 'sort-3',
      idEcole: 'ecole3',
      touche: 3,
      degatsBase: 160,
      cooldownMs: 6308,
    },
    {
      id: 'sort-4',
      idEcole: 'ecole4',
      touche: 4,
      degatsBase: 640,
      cooldownMs: 9146,
    },
    {
      id: 'sort-5',
      idEcole: 'ecole5',
      touche: 5,
      degatsBase: 2560,
      cooldownMs: 13262,
    },
    {
      id: 'sort-lumiere',
      idEcole: 'lumiere',
      touche: 6,
      degatsBase: 10240,
      cooldownMs: 19229,
    },
  ],
  zones: {
    pvBaseVague1Zone1: 10,
    croissanceVague: 1.15,
    nbVagues: 10,
    multBoss: 3,
    multZoneSuivante: 1,
    timerBossS: 30,
  },
  or: {
    orParDegatMoyen: 0.1,
    croissanceOrParZone: 2.8,
    baseClic: 1,
  },
  quetes: [
    {
      id: 'quete-zone-2',
      libelle: 'Atteindre la zone 2',
      typeJalon: 'zoneAtteinte',
      seuil: 2,
      renommeeGagnee: 2,
    },
    {
      id: 'quete-zone-4',
      libelle: 'Atteindre la zone 4',
      typeJalon: 'zoneAtteinte',
      seuil: 4,
      renommeeGagnee: 8,
    },
    {
      id: 'quete-zone-8',
      libelle: 'Atteindre la zone 8',
      typeJalon: 'zoneAtteinte',
      seuil: 8,
      renommeeGagnee: 18,
    },
    {
      id: 'quete-zone-16',
      libelle: 'Atteindre la zone 16',
      typeJalon: 'zoneAtteinte',
      seuil: 16,
      renommeeGagnee: 32,
    },
    {
      id: 'quete-zone-32',
      libelle: 'Atteindre la zone 32',
      typeJalon: 'zoneAtteinte',
      seuil: 32,
      renommeeGagnee: 50,
    },
    {
      id: 'quete-zone-64',
      libelle: 'Atteindre la zone 64',
      typeJalon: 'zoneAtteinte',
      seuil: 64,
      renommeeGagnee: 72,
    },
    {
      id: 'quete-tuer-100',
      libelle: 'Tuer 100 monstres',
      typeJalon: 'monstresTues',
      seuil: 100,
      renommeeGagnee: 2,
    },
    {
      id: 'quete-tuer-1000',
      libelle: 'Tuer 1000 monstres',
      typeJalon: 'monstresTues',
      seuil: 1000,
      renommeeGagnee: 8,
    },
    {
      id: 'quete-tuer-10000',
      libelle: 'Tuer 10000 monstres',
      typeJalon: 'monstresTues',
      seuil: 10000,
      renommeeGagnee: 18,
    },
    {
      id: 'quete-tuer-100000',
      libelle: 'Tuer 100000 monstres',
      typeJalon: 'monstresTues',
      seuil: 100000,
      renommeeGagnee: 32,
    },
    {
      id: 'quete-tuer-1000000',
      libelle: 'Tuer 1000000 monstres',
      typeJalon: 'monstresTues',
      seuil: 1000000,
      renommeeGagnee: 50,
    },
    {
      id: 'quete-premier-prestige',
      libelle: 'Premier prestige',
      typeJalon: 'premierPrestige',
      seuil: 1,
      renommeeGagnee: 10,
    },
  ],
  prestige: {
    k: 0.3,
    alpha: 1,
    bonusPassifB: 0.01,
    bonusPassifBeta: 0.7,
    coutBaseNoeud: 5,
    croissanceCoutNoeud: 1.6,
  },
  ascension: {
    kAscension: 1,
    prestigesParAscension: 6,
    coutBaseNoeud: 1,
    croissanceCoutNoeud: 1.8,
  },
  noeuds: [
    {
      id: 'eclats-degats-1',
      arbre: 'eclats',
      effet: 'multDegats',
      effetParRang: 1.25,
      rangMax: 5,
      coutRelatif: 1,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'eclats-degats-2',
      arbre: 'eclats',
      effet: 'multDegats',
      effetParRang: 1.6,
      rangMax: 3,
      coutRelatif: 10,
      prerequis: ['eclats-degats-1'],
      idSortCible: null,
    },
    {
      id: 'eclats-degats-3',
      arbre: 'eclats',
      effet: 'multDegats',
      effetParRang: 2,
      rangMax: 2,
      coutRelatif: 25,
      prerequis: ['eclats-degats-2'],
      idSortCible: null,
    },
    {
      id: 'eclats-degats-infini',
      arbre: 'eclats',
      effet: 'multDegats',
      effetParRang: 1.18,
      rangMax: null,
      coutRelatif: 2,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'eclats-or-1',
      arbre: 'eclats',
      effet: 'multOr',
      effetParRang: 1.3,
      rangMax: 5,
      coutRelatif: 1,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'eclats-or-2',
      arbre: 'eclats',
      effet: 'multOr',
      effetParRang: 1.5,
      rangMax: 3,
      coutRelatif: 4,
      prerequis: ['eclats-or-1'],
      idSortCible: null,
    },
    {
      id: 'eclats-or-3',
      arbre: 'eclats',
      effet: 'multOr',
      effetParRang: 2,
      rangMax: 2,
      coutRelatif: 25,
      prerequis: ['eclats-or-2'],
      idSortCible: null,
    },
    {
      id: 'eclats-zone-depart',
      arbre: 'eclats',
      effet: 'zoneDepart',
      effetParRang: 1,
      rangMax: 5,
      coutRelatif: 6,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'eclats-cooldown-1',
      arbre: 'eclats',
      effet: 'reductionCooldown',
      effetParRang: 0.9,
      rangMax: 3,
      coutRelatif: 3,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'eclats-cooldown-2',
      arbre: 'eclats',
      effet: 'reductionCooldown',
      effetParRang: 0.85,
      rangMax: 2,
      coutRelatif: 8,
      prerequis: ['eclats-cooldown-1'],
      idSortCible: null,
    },
    {
      id: 'ascension-autocast-feu',
      arbre: 'ascension',
      effet: 'autoCast',
      effetParRang: 1,
      rangMax: 1,
      coutRelatif: 1,
      prerequis: [],
      idSortCible: 'sort-feu',
    },
    {
      id: 'ascension-autocast-glace',
      arbre: 'ascension',
      effet: 'autoCast',
      effetParRang: 1,
      rangMax: 1,
      coutRelatif: 2,
      prerequis: ['ascension-autocast-feu'],
      idSortCible: 'sort-glace',
    },
    {
      id: 'ascension-autocast-lumiere',
      arbre: 'ascension',
      effet: 'autoCast',
      effetParRang: 1,
      rangMax: 1,
      coutRelatif: 8,
      prerequis: ['ascension-autocast-glace'],
      idSortCible: 'sort-lumiere',
    },
    {
      id: 'ascension-synergie-ecoles',
      arbre: 'ascension',
      effet: 'synergieEcoles',
      effetParRang: 0.05,
      rangMax: 5,
      coutRelatif: 3,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'ascension-or-depart',
      arbre: 'ascension',
      effet: 'orDepart',
      effetParRang: 1000,
      rangMax: 5,
      coutRelatif: 2,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'ascension-zone-depart',
      arbre: 'ascension',
      effet: 'zoneDepart',
      effetParRang: 1,
      rangMax: 3,
      coutRelatif: 5,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'ascension-degats-infini',
      arbre: 'ascension',
      effet: 'multDegats',
      effetParRang: 1.15,
      rangMax: null,
      coutRelatif: 4,
      prerequis: [],
      idSortCible: null,
    },
    {
      id: 'ascension-cooldown',
      arbre: 'ascension',
      effet: 'reductionCooldown',
      effetParRang: 0.9,
      rangMax: 3,
      coutRelatif: 6,
      prerequis: [],
      idSortCible: null,
    },
  ],
  ameliorations: [
    {
      id: 'amelioration-1',
      coutBase: 100,
      croissance: 2,
      effetMult: 1.25,
      monnaie: 'or',
      paliersMax: null,
    },
    {
      id: 'amelioration-2',
      coutBase: 5000,
      croissance: 2,
      effetMult: 1.25,
      monnaie: 'or',
      paliersMax: null,
    },
  ],
  equipement: [
    {
      id: 'equipement-1',
      coutBase: 5,
      croissance: 1.5,
      effetMult: 1.5,
      monnaie: 'renommee',
      paliersMax: 10,
    },
    {
      id: 'equipement-2',
      coutBase: 25,
      croissance: 1.605,
      effetMult: 1.995,
      monnaie: 'renommee',
      paliersMax: 10,
    },
  ],
  fin: {
    nAscensionsRequises: 4,
    zoneBossFinal: 1000,
  },
}

/**
 * Contraintes §8 que le rapport archivé documente comme NON tenues, et pourquoi.
 *
 * `equilibrage:check` s'en sert dans les deux sens : une contrainte rouge absente de cette liste
 * fait échouer la vérification, et une contrainte listée ici qui redevient verte la fait échouer
 * aussi — pour qu'une dérogation périmée ne survive jamais à sa raison d'être.
 */
export const CONTRAINTES_NON_TENUES: Readonly<Record<string, string>> = {}

/**
 * EXG-28 — constantes de la **zone dédiée** du boss final. Exportées à côté de `CONSTANTES` et non
 * dans `ConstantesFin`, parce que le type de `src/domain/types.ts` ne porte pas encore ces champs :
 * T-13 les y intègre et câble la logique d'accès (`ascensions ≥ nAscensionsRequises`) ainsi que le
 * calcul des PV. Ici, seuls les nombres.
 *
 * `zoneDediee` n'est **pas** une profondeur de progression : le boss final ne vit pas sur l'échelle
 * normale des zones, sinon le joueur le traverse pendant un run ordinaire. Ce n'est qu'un
 * identifiant, choisi hors de portée de la progression mesurée. Les PV, eux, sont bien exprimés sur
 * la formule de zone du moteur pour rester cohérents avec `pvBaseVague1` et `multBoss` :
 *   `PV_boss_final = pvBoss(profondeurEquivalente) × multPv`.
 */
export interface ParametresBossFinal {
  readonly zoneDediee: number
  readonly profondeurEquivalente: number
  readonly multPv: number
  readonly timerS: number
}

export const BOSS_FINAL: ParametresBossFinal = {
  zoneDediee: 1000,
  profondeurEquivalente: 100,
  multPv: 5,
  timerS: 30,
}
