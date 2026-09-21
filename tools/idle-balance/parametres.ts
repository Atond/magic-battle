// Vecteur de paramètres d'équilibrage → objet `Constantes` du moteur.
//
// Pourquoi ce fichier : la méthode imposée est « une variable à la fois » (skill `idle-balance`, ADR-10).
// Un objet `Constantes` est un arbre imbriqué, pénible à faire varier coordonnée par coordonnée ; ce
// vecteur plat l'est. `construireConstantes` est la seule passerelle entre les deux, donc la seule
// définition de la **forme** des formules paramétrées (exposants, familles de coût, topologie d'arbre).
//
// Rien ici n'est livré tel quel : `search.ts` fait bouger ces coordonnées, mesure, et n'écrit
// `src/donnees/constantes.ts` qu'à partir du vecteur retenu, tracé dans `rapports/<date>.md`.

import type {
  Constantes,
  ConstantesFin,
  IdArbre,
  IdEcole,
  ParametresAchatMultiplicatif,
  ParametresEcole,
  ParametresNoeudArbre,
  ParametresQuete,
  ParametresSort,
  TypeEffetNoeud,
} from '../../src/domain/types.ts'

/** Ordre canonique des six écoles (§5) : il fixe l'indice utilisé par les suites géométriques ci-dessous. */
export const ORDRE_ECOLES: readonly IdEcole[] = ['feu', 'glace', 'ecole3', 'ecole4', 'ecole5', 'lumiere']

/** Identifiants de sorts, un par école (§5 « une École débloque un Sort »). */
export const IDS_SORTS: readonly string[] = [
  'sort-feu',
  'sort-glace',
  'sort-3',
  'sort-4',
  'sort-5',
  'sort-lumiere',
]

/**
 * Coordonnées d'équilibrage. Chaque champ est soit **cherché** par `search.ts`, soit **balayé** par la
 * passe de sensibilité pour prouver que la fourchette retenue tient les contraintes §8 : aucun champ
 * n'est posé sans mesure (ADR-10).
 */
export interface Parametres {
  /* — boucle de simulation (EXG-1 à 3) — */
  nTicksMax: number
  /** `H` en heures, contraint à [8, 12] par §8. */
  plafondHeures: number

  /* — écoles : suite géométrique sur les six écoles (repère du genre ×10-15 coût, ×5-8 production) — */
  ecoleCoutBase: number
  ecoleFacteurCout: number
  ecoleCroissance: number
  /** Écart de croissance de coût entre l'école `i` et l'école `i+1` (0 = même croissance partout). */
  ecoleEcartCroissance: number
  ecoleProduction: number
  ecoleFacteurProduction: number
  paliersSeuils: readonly number[]
  multPalier: number
  /** Une école révélée tous les `pasRevelation` boss, à partir de la zone `pasRevelation` (EXG-8). */
  pasRevelation: number

  /* — sorts actifs (EXG-11 à 13) — */
  /** Dégâts d'un sort = `production_base` de son école × ce facteur. */
  sortFacteurDegats: number
  sortCooldownBaseMs: number
  sortFacteurCooldown: number

  /* — zones (EXG-15, 16, ADR-13) — */
  pvBaseVague1Zone1: number
  croissanceVague: number
  nbVagues: number
  multBoss: number
  multZoneSuivante: number
  timerBossS: number

  /* — or (EXG-6) — */
  orParDegatMoyen: number
  croissanceOrParZone: number
  baseClic: number

  /* — améliorations (or, EXG-42) : `n` pistes multiplicatives — */
  ameliorationCoutBase: number
  ameliorationFacteurCout: number
  ameliorationCroissance: number
  ameliorationEffetMult: number
  ameliorationNombre: number

  /* — équipement (renommée, EXG-43) — */
  equipementCoutBase: number
  equipementCroissance: number
  equipementEffetMult: number
  equipementPaliersMax: number

  /* — quêtes (EXG-54) — */
  renommeeFacteur: number
  /**
   * Jalons de zone des quêtes, en suite géométrique : `jalonZoneBase × jalonZoneFacteur^i`.
   * C'est la seule source de croissance du jeu qui se débloque **progressivement sur toute la partie**
   * (la Renommée paie l'équipement, EXG-10/EXG-43, dont les paliers survivent au prestige, ADR-16).
   * Le simulateur s'en sert pour faire baisser lentement le coût en temps d'une zone, condition
   * nécessaire pour que la durée d'un run **croisse** d'un run au suivant (§8).
   */
  jalonZoneBase: number
  jalonZoneFacteur: number
  nombreJalonsZone: number

  /* — prestige (EXG-18, 38, 39) — */
  k: number
  alpha: number
  bonusPassifB: number
  bonusPassifBeta: number
  eclatsCoutBaseNoeud: number
  eclatsCroissanceCoutNoeud: number
  /** Facteur de dégâts par rang du nœud répétable de l'arbre d'Éclats (rangs infinis, §8). */
  eclatsEffetRepetable: number
  eclatsCoutRelatifRepetable: number

  /* — ascension (EXG-20, 40) — */
  kAscension: number
  prestigesParAscension: number
  ascCoutBaseNoeud: number
  ascCroissanceCoutNoeud: number
  ascEffetRepetable: number
  ascCoutRelatifRepetable: number
  ascSynergieParRang: number

  /* — fin de partie (EXG-28, 44) — */
  nAscensionsRequises: number
  /**
   * EXG-28 — **identifiant** de la zone dédiée du boss final, et seul identifiant : il n'y a pas de
   * second champ `zoneDediee`, ce serait le même nombre sous deux noms. Ce n'est pas une profondeur de
   * progression — le boss final ne vit pas sur l'échelle normale des zones, sinon le joueur le traverse
   * au premier run, ce que la zone maximale mesurée (118) a révélé sur la valeur 50 de la v4. Cet entier
   * ne sert qu'à nommer la zone ; sa seule exigence est de ne jamais entrer en collision avec la
   * progression normale, ce que le rapport vérifie par la mesure.
   */
  zoneBossFinal: number
  /**
   * PV du boss final, exprimés sur la formule de zone pour rester cohérents avec `pvBaseVague1` et
   * `multBoss` : `PV = pvBoss(bossFinalProfondeurEquivalente) × bossFinalMultPv`. Sorties du
   * simulateur : la profondeur équivalente et le multiplicateur sont cherchés, pas choisis.
   */
  bossFinalProfondeurEquivalente: number
  bossFinalMultPv: number
  /** Chrono du combat final, en secondes (EXG-16 s'applique au boss final, EXG-28). */
  bossFinalTimerS: number
}

/* ───────────────────────────────────────────────────────────────── construction des sous-objets */

function ecoles(p: Parametres): Readonly<Record<IdEcole, ParametresEcole>> {
  const table = {} as Record<IdEcole, ParametresEcole>
  ORDRE_ECOLES.forEach((id, i) => {
    table[id] = {
      coutBase: p.ecoleCoutBase * p.ecoleFacteurCout ** i,
      croissance: p.ecoleCroissance + p.ecoleEcartCroissance * i,
      productionBase: p.ecoleProduction * p.ecoleFacteurProduction ** i,
      paliersSeuils: p.paliersSeuils,
      multiplicateurParPalier: p.multPalier,
      // EXG-9 — l'école de départ n'attend aucun boss ; EXG-41 — la 6e n'est révélée que par l'Ascension.
      zoneRevelation: i === 0 || i === ORDRE_ECOLES.length - 1 ? null : i * p.pasRevelation,
      requiertAscension: i === ORDRE_ECOLES.length - 1,
    }
  })
  return table
}

function sorts(p: Parametres): readonly ParametresSort[] {
  return IDS_SORTS.map((id, i) => ({
    id,
    idEcole: ORDRE_ECOLES[i] as IdEcole,
    touche: (i + 1) as 1 | 2 | 3 | 4 | 5 | 6,
    degatsBase: p.ecoleProduction * p.ecoleFacteurProduction ** i * p.sortFacteurDegats,
    cooldownMs: Math.round(p.sortCooldownBaseMs * p.sortFacteurCooldown ** i),
  }))
}

/**
 * EXG-54 / ADR-11 — jalons de quête (les succès sont des quêtes). La Renommée d'une quête est
 * proportionnelle à son rang : `renommeeFacteur` fixe l'échelle, l'équipement la consomme (EXG-10).
 */
function quetes(p: Parametres): readonly ParametresQuete[] {
  const jalonsZone: number[] = []
  for (let i = 0; i < Math.max(Math.round(p.nombreJalonsZone), 1); i += 1) {
    const seuil = Math.round(p.jalonZoneBase * p.jalonZoneFacteur ** i)
    if (jalonsZone[jalonsZone.length - 1] !== seuil) jalonsZone.push(seuil)
  }
  const jalonsTues = [100, 1_000, 10_000, 100_000, 1_000_000]
  const liste: ParametresQuete[] = []
  jalonsZone.forEach((seuil, i) => {
    liste.push({
      id: `quete-zone-${seuil}`,
      libelle: `Atteindre la zone ${seuil}`,
      typeJalon: 'zoneAtteinte',
      seuil,
      renommeeGagnee: Math.round(p.renommeeFacteur * (i + 1) ** 2),
    })
  })
  jalonsTues.forEach((seuil, i) => {
    liste.push({
      id: `quete-tuer-${seuil}`,
      libelle: `Tuer ${seuil} monstres`,
      typeJalon: 'monstresTues',
      seuil,
      renommeeGagnee: Math.round(p.renommeeFacteur * (i + 1) ** 2),
    })
  })
  liste.push({
    id: 'quete-premier-prestige',
    libelle: 'Premier prestige',
    typeJalon: 'premierPrestige',
    seuil: 1,
    renommeeGagnee: Math.round(p.renommeeFacteur * 5),
  })
  return liste
}

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
 * EXG-39 — arbre d'Éclats : 10 nœuds (fourchette 8-12), dont **un répétable à rangs infinis** (§8).
 * La topologie (qui dépend de qui) est fixe ; ce sont les intensités et l'échelle de coût que le
 * simulateur fait varier.
 */
function noeudsEclats(p: Parametres): readonly ParametresNoeudArbre[] {
  return [
    noeud('eclats-degats-1', 'eclats', 'multDegats', 1.25, 5, 1),
    noeud('eclats-degats-2', 'eclats', 'multDegats', 1.6, 3, 10, ['eclats-degats-1']),
    noeud('eclats-degats-3', 'eclats', 'multDegats', 2, 2, 25, ['eclats-degats-2']),
    noeud(
      'eclats-degats-infini',
      'eclats',
      'multDegats',
      p.eclatsEffetRepetable,
      null,
      p.eclatsCoutRelatifRepetable,
    ),
    noeud('eclats-or-1', 'eclats', 'multOr', 1.3, 5, 1),
    noeud('eclats-or-2', 'eclats', 'multOr', 1.5, 3, 4, ['eclats-or-1']),
    noeud('eclats-or-3', 'eclats', 'multOr', 2, 2, 25, ['eclats-or-2']),
    noeud('eclats-zone-depart', 'eclats', 'zoneDepart', 1, 5, 6),
    noeud('eclats-cooldown-1', 'eclats', 'reductionCooldown', 0.9, 3, 3),
    noeud('eclats-cooldown-2', 'eclats', 'reductionCooldown', 0.85, 2, 8, ['eclats-cooldown-1']),
  ]
}

/** EXG-40 — arbre d'Ascension : 8 nœuds permanents (fourchette 6-10), dont un répétable (§8). */
function noeudsAscension(p: Parametres): readonly ParametresNoeudArbre[] {
  return [
    noeud('ascension-autocast-feu', 'ascension', 'autoCast', 1, 1, 1, [], 'sort-feu'),
    noeud('ascension-autocast-glace', 'ascension', 'autoCast', 1, 1, 2, ['ascension-autocast-feu'], 'sort-glace'),
    noeud('ascension-autocast-lumiere', 'ascension', 'autoCast', 1, 1, 8, ['ascension-autocast-glace'], 'sort-lumiere'),
    noeud('ascension-synergie-ecoles', 'ascension', 'synergieEcoles', p.ascSynergieParRang, 5, 3),
    noeud('ascension-or-depart', 'ascension', 'orDepart', 1_000, 5, 2),
    noeud('ascension-zone-depart', 'ascension', 'zoneDepart', 1, 3, 5),
    noeud(
      'ascension-degats-infini',
      'ascension',
      'multDegats',
      p.ascEffetRepetable,
      null,
      p.ascCoutRelatifRepetable,
    ),
    noeud('ascension-cooldown', 'ascension', 'reductionCooldown', 0.9, 3, 6),
  ]
}

function ameliorations(p: Parametres): readonly ParametresAchatMultiplicatif[] {
  const liste: ParametresAchatMultiplicatif[] = []
  for (let i = 0; i < p.ameliorationNombre; i += 1) {
    liste.push({
      id: `amelioration-${i + 1}`,
      coutBase: p.ameliorationCoutBase * p.ameliorationFacteurCout ** i,
      croissance: p.ameliorationCroissance,
      effetMult: p.ameliorationEffetMult,
      monnaie: 'or',
      paliersMax: null,
    })
  }
  return liste
}

function equipement(p: Parametres): readonly ParametresAchatMultiplicatif[] {
  return [
    {
      id: 'equipement-1',
      coutBase: p.equipementCoutBase,
      croissance: p.equipementCroissance,
      effetMult: p.equipementEffetMult,
      monnaie: 'renommee',
      paliersMax: p.equipementPaliersMax,
    },
    {
      id: 'equipement-2',
      coutBase: p.equipementCoutBase * 5,
      croissance: p.equipementCroissance * 1.07,
      effetMult: p.equipementEffetMult * 1.33,
      monnaie: 'renommee',
      paliersMax: p.equipementPaliersMax,
    },
  ]
}

/**
 * EXG-28 — `fin` tel que ce lot le livre : le contrat de `src/domain/types.ts` (`nAscensionsRequises`,
 * `zoneBossFinal`) **plus** les trois nombres qui décrivent le boss de la zone dédiée. Ils vivent dans
 * `fin` et non à côté parce que le moteur reçoit ses valeurs d'équilibrage en **un seul** objet
 * `Constantes` : les sortir obligerait soit à les lui passer en deux morceaux, soit à recomposer l'objet
 * à la main dans `src/donnees/`.
 *
 * T-13 déplace ces trois champs dans `ConstantesFin` (`src/domain/types.ts`) et ce type local disparaît.
 */
export interface ConstantesFinLivree extends ConstantesFin {
  /** Profondeur dont la formule de zone du moteur donne les PV de base du boss final. */
  readonly pvProfondeurEquivalente: number
  /** Multiplicateur appliqué à ces PV : `PV = pvBoss(pvProfondeurEquivalente) × pvMultiplicateur`. */
  readonly pvMultiplicateur: number
  /** Chrono du combat final en secondes (EXG-16 appliqué au boss final), distinct de `zones.timerBossS`. */
  readonly timerBossFinalS: number
}

/** L'objet livré : un `Constantes` dont le bloc `fin` porte en plus les nombres du boss final. */
export type ConstantesLivrees = Omit<Constantes, 'fin'> & { readonly fin: ConstantesFinLivree }

/** Seule passerelle vecteur → contrat du moteur (§8). */
export function construireConstantes(p: Parametres): ConstantesLivrees {
  return {
    tick: { nTicksMax: p.nTicksMax },
    horsLigne: { plafondHeures: p.plafondHeures },
    ecoles: ecoles(p),
    sorts: sorts(p),
    zones: {
      pvBaseVague1Zone1: p.pvBaseVague1Zone1,
      croissanceVague: p.croissanceVague,
      nbVagues: p.nbVagues,
      multBoss: p.multBoss,
      multZoneSuivante: p.multZoneSuivante,
      timerBossS: p.timerBossS,
    },
    or: {
      orParDegatMoyen: p.orParDegatMoyen,
      croissanceOrParZone: p.croissanceOrParZone,
      baseClic: p.baseClic,
    },
    quetes: quetes(p),
    prestige: {
      k: p.k,
      alpha: p.alpha,
      bonusPassifB: p.bonusPassifB,
      bonusPassifBeta: p.bonusPassifBeta,
      coutBaseNoeud: p.eclatsCoutBaseNoeud,
      croissanceCoutNoeud: p.eclatsCroissanceCoutNoeud,
    },
    ascension: {
      kAscension: p.kAscension,
      prestigesParAscension: p.prestigesParAscension,
      coutBaseNoeud: p.ascCoutBaseNoeud,
      croissanceCoutNoeud: p.ascCroissanceCoutNoeud,
    },
    noeuds: [...noeudsEclats(p), ...noeudsAscension(p)],
    ameliorations: ameliorations(p),
    equipement: equipement(p),
    fin: {
      nAscensionsRequises: p.nAscensionsRequises,
      zoneBossFinal: p.zoneBossFinal,
      pvProfondeurEquivalente: p.bossFinalProfondeurEquivalente,
      pvMultiplicateur: p.bossFinalMultPv,
      timerBossFinalS: p.bossFinalTimerS,
    },
  }
}

/**
 * Point de départ de la recherche : les valeurs d'amorçage de `graines.ts` remises sous forme de vecteur.
 * Aucune de ces coordonnées n'est livrable — `search.ts` les déplace une à une.
 */
export const PARAMETRES_DEPART: Parametres = {
  nTicksMax: 600,
  plafondHeures: 10,

  ecoleCoutBase: 10,
  ecoleFacteurCout: 10,
  ecoleCroissance: 1.15,
  ecoleEcartCroissance: 0.01,
  ecoleProduction: 0.5,
  ecoleFacteurProduction: 6,
  paliersSeuils: [10, 25, 50, 100],
  multPalier: 2,
  pasRevelation: 2,

  sortFacteurDegats: 20,
  sortCooldownBaseMs: 3_000,
  sortFacteurCooldown: 1.45,

  pvBaseVague1Zone1: 10,
  croissanceVague: 1.25,
  nbVagues: 10,
  multBoss: 5,
  multZoneSuivante: 1.3,
  timerBossS: 30,

  orParDegatMoyen: 0.1,
  croissanceOrParZone: 1.35,
  baseClic: 1,

  ameliorationCoutBase: 100,
  ameliorationFacteurCout: 50,
  ameliorationCroissance: 2,
  ameliorationEffetMult: 1.25,
  ameliorationNombre: 2,

  equipementCoutBase: 5,
  equipementCroissance: 1.5,
  equipementEffetMult: 1.5,
  equipementPaliersMax: 10,

  renommeeFacteur: 5,
  jalonZoneBase: 2,
  jalonZoneFacteur: 2,
  nombreJalonsZone: 6,

  k: 1,
  alpha: 1.5,
  bonusPassifB: 0.02,
  bonusPassifBeta: 0.9,
  eclatsCoutBaseNoeud: 5,
  eclatsCroissanceCoutNoeud: 1.6,
  eclatsEffetRepetable: 1.1,
  eclatsCoutRelatifRepetable: 2,

  kAscension: 1,
  prestigesParAscension: 6,
  ascCoutBaseNoeud: 1,
  ascCroissanceCoutNoeud: 1.8,
  ascEffetRepetable: 1.15,
  ascCoutRelatifRepetable: 4,
  ascSynergieParRang: 0.05,

  nAscensionsRequises: 4,
  zoneBossFinal: 1_000,
  bossFinalProfondeurEquivalente: 120,
  bossFinalMultPv: 1,
  bossFinalTimerS: 60,
}
