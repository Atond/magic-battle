// GRAINES D'ÉQUILIBRAGE — valeurs de départ du simulateur, **non contractuelles** (spec §8, ADR-10).
//
// Ce fichier vit hors de `src/` exprès : tant que le rapport T-14 n'existe pas, aucune valeur
// d'équilibrage n'a le droit d'entrer dans `src/` (`scripts/verify.sh` refuse les marqueurs
// « graine » / « à valider » dans `src/`). Deux usages :
//   1. amorcer la recherche de `tools/idle-balance` (T-14) ;
//   2. donner aux tests du moteur (`tests/domain/`) un objet `Constantes` complet et lisible.
//
// Chaque valeur ci-dessous est justifiée par un ORDRE DE GRANDEUR, jamais par un réglage fin : le
// simulateur (T-14) cherche les vraies valeurs et les formes, puis T-15 les recopie dans `src/donnees/`.
// Contraintes dures que la sortie devra respecter (§8) : 1er prestige en 2-3 h, aucun mur > 90 min avant
// le 1er prestige, 20 ≤ N_ASCENSIONS_REQUISES × PRESTIGES_PAR_ASCENSION ≤ 30, ≥ 40 h de jeu cumulé,
// toute valeur normale < 1e300 (EXG-37).

import type {
  Constantes,
  IdArbre,
  IdEcole,
  ParametresEcole,
  ParametresNoeudArbre,
  ParametresQuete,
  ParametresSort,
  TypeEffetNoeud,
} from '../../src/domain/types.ts'

/** §8 — seuils de palier tranchés en interview (10/25/50/100), ×2 par seuil franchi. */
const PALIERS_SEUILS = [10, 25, 50, 100] as const
const MULTIPLICATEUR_PAR_PALIER = 2

/**
 * Graine d'école : coût de premier niveau, croissance géométrique du coût, production par niveau.
 * Ordre de grandeur voulu : chaque école suivante coûte ~×10 et produit ~×6 de plus que la précédente,
 * de sorte qu'aucune n'écrase les autres plus de quelques minutes. Croissance de coût 1,15 → 1,20 :
 * fourchette classique des idle (un niveau double de prix tous les 4 à 5 achats).
 */
function ecole(
  coutBase: number,
  croissance: number,
  productionBase: number,
  zoneRevelation: number | null,
  requiertAscension = false,
): ParametresEcole {
  return {
    coutBase,
    croissance,
    productionBase,
    paliersSeuils: PALIERS_SEUILS,
    multiplicateurParPalier: MULTIPLICATEUR_PAR_PALIER,
    zoneRevelation,
    requiertAscension,
  }
}

const ECOLES: Readonly<Record<IdEcole, ParametresEcole>> = {
  // École de départ (EXG-9) : premier niveau accessible en quelques clics, aucune révélation à attendre.
  feu: ecole(10, 1.15, 0.5, null),
  // Révélée par le boss de la zone 2 (EXG-8, énoncé explicite de la spec).
  glace: ecole(100, 1.16, 3, 2),
  // Ordre de grandeur : une révélation toutes les deux zones, pour que chaque boss vaincu ouvre
  // quelque chose à moins d'une heure d'intervalle avant le 1er prestige (§8).
  ecole3: ecole(1_000, 1.17, 18, 4),
  ecole4: ecole(10_000, 1.18, 110, 6),
  ecole5: ecole(100_000, 1.19, 650, 8),
  // 6e école, révélée par la 1re Ascension et non par un boss (EXG-41).
  lumiere: ecole(1_000_000, 1.2, 4_000, null, true),
}

/**
 * Sorts actifs (EXG-11 à 13) : un par école, touches 1 à 6. Ordres de grandeur voulus — un sort vaut
 * quelques secondes de production passive de son école (dégâts ≈ production_base × 20), cooldowns
 * échelonnés de 3 à 20 s pour que la barre ait un rythme : le sort le plus fort est le plus lent.
 */
const SORTS: readonly ParametresSort[] = [
  { id: 'sort-feu', idEcole: 'feu', touche: 1, degatsBase: 10, cooldownMs: 3_000 },
  { id: 'sort-glace', idEcole: 'glace', touche: 2, degatsBase: 60, cooldownMs: 5_000 },
  { id: 'sort-3', idEcole: 'ecole3', touche: 3, degatsBase: 360, cooldownMs: 8_000 },
  { id: 'sort-4', idEcole: 'ecole4', touche: 4, degatsBase: 2_200, cooldownMs: 12_000 },
  { id: 'sort-5', idEcole: 'ecole5', touche: 5, degatsBase: 13_000, cooldownMs: 16_000 },
  { id: 'sort-lumiere', idEcole: 'lumiere', touche: 6, degatsBase: 80_000, cooldownMs: 20_000 },
]

/**
 * Quêtes (EXG-54) — les succès sont des quêtes (ADR-11), trois types de jalons seulement. Ordre de
 * grandeur : la Renommée cumulée des premières quêtes doit payer les 2-3 premiers paliers d'équipement
 * (coût_base 5 à 25, cf. `equipement` ci-dessous), donc des montants à un ou deux chiffres. Les
 * libellés sont de travail : T-26 écrit les définitifs dans `src/donnees/quetes.ts`.
 */
const QUETES: readonly ParametresQuete[] = [
  { id: 'quete-zone-2', libelle: 'Atteindre la zone 2', typeJalon: 'zoneAtteinte', seuil: 2, renommeeGagnee: 5 },
  { id: 'quete-zone-5', libelle: 'Atteindre la zone 5', typeJalon: 'zoneAtteinte', seuil: 5, renommeeGagnee: 15 },
  { id: 'quete-zone-10', libelle: 'Atteindre la zone 10', typeJalon: 'zoneAtteinte', seuil: 10, renommeeGagnee: 40 },
  { id: 'quete-tuer-100', libelle: 'Tuer 100 monstres', typeJalon: 'monstresTues', seuil: 100, renommeeGagnee: 10 },
  { id: 'quete-tuer-1000', libelle: 'Tuer 1000 monstres', typeJalon: 'monstresTues', seuil: 1_000, renommeeGagnee: 30 },
  { id: 'quete-premier-prestige', libelle: 'Premier prestige', typeJalon: 'premierPrestige', seuil: 1, renommeeGagnee: 25 },
]

/**
 * Fabrique de nœud d'arbre (EXG-39, EXG-40). `coutRelatif` pèse le nœud dans l'échelle de coût de son
 * arbre (`coutBaseNoeud` × `croissanceCoutNoeud^r`, cf. `prestige`/`ascension` ci-dessous) : un nœud à
 * `coutRelatif = 10` coûte dix fois le nœud de référence au même rang.
 */
function noeud(
  id: string,
  arbre: IdArbre,
  effet: TypeEffetNoeud,
  effetParRang: number,
  rangMax: number | null,
  coutRelatif: number,
  prerequis: readonly string[] = [],
  idSortCible: string | null = null,
): ParametresNoeudArbre {
  return { id, arbre, effet, effetParRang, rangMax, coutRelatif, prerequis, idSortCible }
}

/**
 * Arbre d'Éclats (EXG-39) — 10 nœuds, dans la fourchette 8-12 exigée, couvrant les quatre leviers
 * énoncés par la spec : dégâts, or, zone de départ, cooldowns. Un seul nœud à rangs infinis
 * (`eclats-degats-infini`), c'est le déversoir des Éclats de fin de cycle.
 *
 * Ordres de grandeur voulus (jamais un réglage fin) :
 *  - le 1er prestige rapporte quelques dizaines d'Éclats (`floor(zone_max^1,5)`, zone_max ~10-15), donc
 *    les nœuds racines (`coutRelatif = 1`, soit 5 Éclats au rang 0) doivent s'ouvrir dès ce prestige-là ;
 *  - les nœuds de 2e rideau (`coutRelatif` 4 à 10) tombent vers le 3e prestige, ceux de 3e rideau
 *    (`coutRelatif` 25) vers le 5e, pour que chaque prestige d'un cycle de 6 ouvre quelque chose ;
 *  - un rang de dégâts vaut ×1,1 à ×2 : l'arbre entier doit peser un ordre de grandeur environ, pas
 *    quatre, sinon il écrase le bonus passif (EXG-38) qu'il est censé compléter (ADR-8).
 */
const NOEUDS_ECLATS: readonly ParametresNoeudArbre[] = [
  noeud('eclats-degats-1', 'eclats', 'multDegats', 1.25, 5, 1),
  noeud('eclats-degats-2', 'eclats', 'multDegats', 1.6, 3, 10, ['eclats-degats-1']),
  noeud('eclats-degats-3', 'eclats', 'multDegats', 2, 2, 25, ['eclats-degats-2']),
  // Le nœud répétable exigé par §8 : racine toujours ouverte (c'est le déversoir des Éclats de
  // fin de cycle), rangs infinis, coût ×1,6 par rang — donc un puits sans fond.
  noeud('eclats-degats-infini', 'eclats', 'multDegats', 1.1, null, 2),
  noeud('eclats-or-1', 'eclats', 'multOr', 1.3, 5, 1),
  noeud('eclats-or-2', 'eclats', 'multOr', 1.5, 3, 4, ['eclats-or-1']),
  noeud('eclats-or-3', 'eclats', 'multOr', 2, 2, 25, ['eclats-or-2']),
  // Zone de départ : 5 zones au plus, pour raccourcir le rejeu sans sauter les révélations d'écoles.
  noeud('eclats-zone-depart', 'eclats', 'zoneDepart', 1, 5, 6),
  // Cooldowns : −10 % puis −15 % par rang, plancher effectif ~×0,53 avec les deux nœuds au maximum.
  noeud('eclats-cooldown-1', 'eclats', 'reductionCooldown', 0.9, 3, 3),
  noeud('eclats-cooldown-2', 'eclats', 'reductionCooldown', 0.85, 2, 8, ['eclats-cooldown-1']),
]

/**
 * Arbre d'Ascension (EXG-40) — 8 nœuds **permanents**, dans la fourchette 6-10, couvrant les trois
 * leviers énoncés par la spec : auto-cast des sorts, synergies entre écoles, bonus de départ de run.
 * Un seul nœud à rangs infinis (`ascension-degats-infini`).
 *
 * Ordres de grandeur voulus : la 1re Ascension arrive après 6 prestiges, avec un cumul d'Éclats à vie de
 * l'ordre de quelques centaines à quelques milliers, donc `floor(√cumul)` ≈ 20 à 50 Points. Les nœuds
 * racines coûtent 1 Point au rang 0 (`coutBaseNoeud = 1`, `coutRelatif = 1`) : la 1re Ascension doit
 * pouvoir ouvrir deux ou trois branches, pas l'arbre entier — il reste 3 Ascensions à jouer (§8).
 */
const NOEUDS_ASCENSION: readonly ParametresNoeudArbre[] = [
  noeud('ascension-autocast-feu', 'ascension', 'autoCast', 1, 1, 1, [], 'sort-feu'),
  noeud('ascension-autocast-glace', 'ascension', 'autoCast', 1, 1, 2, ['ascension-autocast-feu'], 'sort-glace'),
  noeud('ascension-autocast-lumiere', 'ascension', 'autoCast', 1, 1, 8, ['ascension-autocast-glace'], 'sort-lumiere'),
  // Synergie : +5 % de dégâts par rang **et par école débloquée** — vaut ×1,5 à 5 rangs et 6 écoles.
  noeud('ascension-synergie-ecoles', 'ascension', 'synergieEcoles', 0.05, 5, 3),
  // Bonus de départ de run (EXG-40) : survit au prestige, c'est tout son intérêt.
  noeud('ascension-or-depart', 'ascension', 'orDepart', 1_000, 5, 2),
  noeud('ascension-zone-depart', 'ascension', 'zoneDepart', 1, 3, 5),
  // Le nœud répétable exigé par §8 : racine toujours ouverte, rangs infinis, coût ×1,8 par rang.
  noeud('ascension-degats-infini', 'ascension', 'multDegats', 1.15, null, 4),
  noeud('ascension-cooldown', 'ascension', 'reductionCooldown', 0.9, 3, 6),
]

/**
 * Jeu de graines complet. À remplacer intégralement par la sortie du rapport T-14 (aucune de ces
 * valeurs n'est à considérer comme équilibrée).
 */
export const GRAINES: Constantes = {
  tick: {
    // Proposition explicite de la spec (EXG-3) : 600 ticks = 60 s de rattrapage itératif au plus.
    nTicksMax: 600,
  },
  horsLigne: {
    // `H ∈ [8, 12]` (§8) : milieu de la fourchette, une nuit de sommeil.
    plafondHeures: 10,
  },
  ecoles: ECOLES,
  sorts: SORTS,
  zones: {
    // Premier monstre tuable en ~2 clics ; 10 vagues par zone puis un boss ×5 PV en 30 s.
    pvBaseVague1Zone1: 10,
    croissanceVague: 1.25,
    nbVagues: 10,
    multBoss: 5,
    // Le ×87,9 composé observé en v1 créait un mur avant le boss 8 (§8) : on part volontairement bas.
    multZoneSuivante: 1.3,
    timerBossS: 30,
  },
  or: {
    // ~1 or pour 10 points de dégâts : l'or reste lisible face aux PV qui croissent plus vite.
    orParDegatMoyen: 0.1,
    croissanceOrParZone: 1.35,
    // §8 « base_clic = 1 » : unité de référence des dégâts.
    baseClic: 1,
  },
  quetes: QUETES,
  prestige: {
    // `Éclats = floor(k × zone_max^α)` : α ~1,5 pour que doubler la zone rende ~2,8× d'Éclats.
    k: 1,
    alpha: 1.5,
    // `(1 + B × Éclats)^β` : +2 % de dégâts par Éclat, exposant légèrement sous-linéaire.
    bonusPassifB: 0.02,
    bonusPassifBeta: 0.9,
    // Échelle de coût de l'arbre d'Éclats : 5 Éclats pour le rang 0 d'un nœud de référence, ×1,6/rang.
    coutBaseNoeud: 5,
    croissanceCoutNoeud: 1.6,
  },
  ascension: {
    // `Points = floor(k_ascension × √Éclats_cumulés)`.
    kAscension: 1,
    // 6 prestiges × 4 Ascensions = 24 prestiges, dans la contrainte dure 20 ≤ total ≤ 30 (§8).
    prestigesParAscension: 6,
    // Échelle de coût de l'arbre d'Ascension : 1 Point pour le rang 0 d'un nœud de référence, ×1,8/rang.
    coutBaseNoeud: 1,
    croissanceCoutNoeud: 1.8,
  },
  noeuds: [...NOEUDS_ECLATS, ...NOEUDS_ASCENSION],
  // Deux achats représentatifs : la liste réelle (et ses textes) est du contenu (T-8, T-26).
  ameliorations: [
    { id: 'amelioration-1', coutBase: 100, croissance: 2, effetMult: 1.25, monnaie: 'or', paliersMax: null },
    { id: 'amelioration-2', coutBase: 5_000, croissance: 2.2, effetMult: 1.5, monnaie: 'or', paliersMax: null },
  ],
  equipement: [
    { id: 'equipement-1', coutBase: 5, croissance: 1.5, effetMult: 1.5, monnaie: 'renommee', paliersMax: 10 },
    { id: 'equipement-2', coutBase: 25, croissance: 1.6, effetMult: 2, monnaie: 'renommee', paliersMax: 10 },
  ],
  fin: {
    // 4 × 6 = 24 prestiges (contrainte dure §8).
    nAscensionsRequises: 4,
    // Zone dédiée du boss final (EXG-28), atteinte au dernier cycle d'Ascension.
    zoneBossFinal: 50,
    // T-13 a déplacé les trois nombres du boss final dans `ConstantesFin` (ils vivaient jusque-là dans
    // `ConstantesFinLivree`). Les valeurs d'amorçage sont celles de `PARAMETRES_DEPART` : comme tout ce
    // fichier, elles ne sont **pas** contractuelles — les valeurs livrées sont dans `src/donnees/`.
    pvProfondeurEquivalente: 120,
    pvMultiplicateur: 1,
    timerBossFinalS: 60,
  },
}
