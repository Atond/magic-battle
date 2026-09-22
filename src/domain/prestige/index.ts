// Prestige — T-6 : gain d'Éclats (EXG-18), réinitialisation du run (EXG-19), confirmation à deux étapes
// (EXG-21), bonus passif du cycle (EXG-38) et arbre de dépense des Éclats (EXG-39, ADR-8).
//
// ADR-8 — les Éclats ont **deux** compteurs, et c'est le point à ne pas rater :
//   `bourse.eclatsPossedes`    → alimente le bonus passif (EXG-38), ne diminue JAMAIS en dépensant ;
//   `bourse.eclatsDepensables` → solde que l'arbre consomme (EXG-39).
// Le prestige crédite les deux du même montant ; seul l'achat d'un nœud touche au second.
//
// Module pur : l'état entre, un nouvel état sort, aucune valeur d'équilibrage locale (tout arrive par
// `Constantes`), aucune lecture d'horloge.

import { FACTEUR_NEUTRE, VAGUE_DEPART, ZONE_DEPART } from '../constantes-moteur.ts'
import { revelerEcolesDeZone } from '../ecoles/index.ts'
import type {
  ApercuPrestige,
  Constantes,
  EtatEcole,
  EtatJeu,
  EtatSort,
  IdEcole,
  PerteDeRun,
  ResultatAchat,
  ResultatReinitialisation,
} from '../types.ts'
import {
  acheterNoeudArbre,
  facteurArbre,
  facteurTousArbres,
  sommeTousArbres,
  synchroniserAutoCast,
} from './arbre.ts'
import { nombreFini, sommeBornee } from './nombres.ts'

export {
  coutRangNoeud,
  coutRangsNoeud,
  noeudParId,
  noeudsDeLArbre,
  prerequisRemplis,
  rangNoeud,
  rangsAchetablesNoeud,
  rangsDeLArbre,
  synchroniserAutoCast,
} from './arbre.ts'
export { nombreFini, sommeBornee } from './nombres.ts'

/* ═══════════════════════════════════════════════════════════════════ EXG-18 — gain d'Éclats */

/**
 * EXG-18 — `Éclats = floor(k × zone_max^α)`, fonction strictement croissante de la profondeur atteinte.
 * `k` et `α` viennent du contrat (§8) : la **forme** comme les constantes sont des sorties du simulateur.
 * Une zone absurde (non finie, négative) est ramenée à la zone de départ : un prestige rapporte toujours
 * au moins ce que rapporte la zone 1, jamais un `NaN`.
 */
export function eclatsAuPrestige(zoneMax: number, constantes: Constantes): number {
  const zone = Number.isFinite(zoneMax) && zoneMax > ZONE_DEPART ? zoneMax : ZONE_DEPART
  return nombreFini(Math.floor(constantes.prestige.k * zone ** constantes.prestige.alpha))
}

/* ════════════════════════════════════════════════════════════════ EXG-38 — bonus passif (§8) */

/**
 * EXG-38 — `(1 + B × Éclats_possédés)^β`, facteur de la chaîne de DPS (§8). Lit `eclatsPossedes`, jamais
 * `eclatsDepensables` : dépenser dans l'arbre ne coûte pas un point de ce bonus (ADR-8). À 0 Éclat le
 * facteur vaut exactement 1 — c'est le facteur neutre du produit, pas une valeur d'équilibrage.
 */
export function bonusPassifEclats(etat: EtatJeu, constantes: Constantes): number {
  const eclats = etat.bourse.eclatsPossedes
  if (!Number.isFinite(eclats) || eclats <= 0) return FACTEUR_NEUTRE
  const facteur = (1 + constantes.prestige.bonusPassifB * eclats) ** constantes.prestige.bonusPassifBeta
  return Number.isFinite(facteur) && facteur > 0 ? facteur : FACTEUR_NEUTRE
}

/* ════════════════════════════════════════════ EXG-39 — effets de l'arbre dans les formules */

/** EXG-39 / §8 — `mult_arbre_Éclats` : produit des nœuds de dégâts achetés dans l'arbre d'Éclats. */
export function multArbreEclats(etat: EtatJeu, constantes: Constantes): number {
  return facteurArbre(etat, 'eclats', 'multDegats', constantes)
}

/** EXG-6 / EXG-39 — facteur appliqué à l'or gagné, tous arbres confondus. */
export function multOrArbres(etat: EtatJeu, constantes: Constantes): number {
  const facteur = facteurTousArbres(etat, 'multOr', constantes)
  return Number.isFinite(facteur) && facteur > 0 ? facteur : FACTEUR_NEUTRE
}

/**
 * EXG-12 / EXG-39 — facteur appliqué à la durée des cooldowns, tous arbres confondus (< 1 = plus court).
 * Le moteur l'applique en faisant tourner l'horloge de recharge `1/facteur` fois plus vite, ce qui est
 * exactement équivalent à raccourcir la durée. Un facteur nul ou absurde est ramené à 1 : un cooldown
 * ne devient jamais instantané par accident.
 */
export function facteurCooldownArbres(etat: EtatJeu, constantes: Constantes): number {
  const facteur = facteurTousArbres(etat, 'reductionCooldown', constantes)
  return Number.isFinite(facteur) && facteur > 0 && facteur <= 1 ? facteur : FACTEUR_NEUTRE
}

/**
 * EXG-19 / EXG-39 / EXG-40 — zone où repart un run après réinitialisation : la zone de départ, décalée
 * par les nœuds « zone de départ » des deux arbres (celui des Éclats disparaît à l'Ascension, ADR-14 ;
 * celui de l'Ascension est permanent).
 */
export function zoneDepartRun(etat: EtatJeu, constantes: Constantes): number {
  const decalage = Math.floor(nombreFini(sommeTousArbres(etat, 'zoneDepart', constantes)))
  return ZONE_DEPART + Math.max(decalage, 0)
}

/** EXG-40 — or crédité au départ d'un run par les nœuds « bonus de départ » (0 sans nœud acheté). */
export function orDepartRun(etat: EtatJeu, constantes: Constantes): number {
  return Math.max(nombreFini(sommeTousArbres(etat, 'orDepart', constantes)), 0)
}

/* ══════════════════════════════════════════════════════════════════ EXG-39 — achat de nœuds */

/**
 * EXG-39 — guichet de l'arbre d'Éclats : paie en Éclats **dépensables**, et en Éclats seulement. Un
 * stock d'Éclats possédés, même astronomique, n'achète rien ici (ADR-8) ; un nœud de l'arbre d'Ascension
 * présenté à ce guichet est refusé pour `mauvaiseMonnaie`.
 */
export function acheterNoeudEclats(
  etat: EtatJeu,
  id: string,
  quantite: number,
  constantes: Constantes,
): ResultatAchat {
  return acheterNoeudArbre(etat, id, quantite, 'eclats', constantes)
}

/* ══════════════════════════════════════════════════ EXG-19 — réinitialisation du run (reset) */

/** Somme des niveaux d'écoles du run : ce que la réinitialisation emporte, affiché avant de confirmer. */
function niveauxEcoles(etat: EtatJeu): number {
  let total = 0
  for (const ecole of Object.values(etat.ecoles)) total += Math.max(ecole.niveau, 0)
  return total
}

/** EXG-19 / EXG-21 — ce qu'un reset de run emporte, à afficher en 1re étape de confirmation. */
export function perteDeRun(etat: EtatJeu): PerteDeRun {
  return {
    zoneAtteinte: Math.max(etat.combat.zone, etat.prestige.zoneMaxDuRun, ZONE_DEPART),
    or: etat.bourse.or,
    niveauxEcoles: niveauxEcoles(etat),
  }
}

/**
 * EXG-19 — écoles d'un run neuf. Le moteur ne nomme aucune école : est disponible au départ celle dont
 * le contrat ne demande ni boss révélateur (`zoneRevelation === null`, EXG-8) ni Ascension (EXG-41).
 * La révélation acquise par l'Ascension survit, elle (EXG-41 ne se rejoue pas à chaque prestige).
 */
function ecolesReinitialisees(
  etat: EtatJeu,
  constantes: Constantes,
): Readonly<Record<IdEcole, EtatEcole>> {
  const ecoles = { ...etat.ecoles }
  for (const [id, ecole] of Object.entries(etat.ecoles) as [IdEcole, EtatEcole][]) {
    const parametres = constantes.ecoles[id]
    if (parametres === undefined) {
      ecoles[id] = { ...ecole, niveau: 0 }
      continue
    }
    const auDepart = parametres.zoneRevelation === null && !parametres.requiertAscension
    const parAscension = parametres.requiertAscension && etat.ascension.sixiemeEcoleDebloquee
    ecoles[id] = { niveau: 0, debloquee: auDepart, revelee: auDepart || parAscension }
  }
  return ecoles
}

/** EXG-19 — les cooldowns en cours ne survivent pas au reset ; l'auto-cast acquis, lui, oui (EXG-40). */
function sortsReinitialises(etat: EtatJeu): Readonly<Record<string, EtatSort>> {
  const sorts: Record<string, EtatSort> = {}
  for (const [id, sort] of Object.entries(etat.sorts)) {
    sorts[id] = { ...sort, cooldownRestantMs: 0 }
  }
  return sorts
}

/**
 * EXG-19 — réinitialise le **run** : zone, vague, phase et cible de combat, or, niveaux d'écoles et
 * paliers payés en or. Ce qui n'est pas du run survit et n'est pas touché ici : Renommée et équipement
 * (EXG-10, monnaie à vie), quêtes accomplies (EXG-54), les deux arbres, l'état d'Ascension, les
 * compteurs à vie du magicien et l'horloge. C'est la liste que la sauvegarde (T-10) et l'UI (T-23)
 * doivent respecter, et le seul endroit qui la définit.
 *
 * Partagé par le prestige (EXG-19) et l'Ascension (EXG-20) : un seul reset de run, donc aucune
 * divergence possible entre les deux couches de méta.
 */
export function reinitialiserRun(etat: EtatJeu, constantes: Constantes): EtatJeu {
  const zone = zoneDepartRun(etat, constantes)

  const vierge: EtatJeu = {
    ...etat,
    bourse: { ...etat.bourse, or: orDepartRun(etat, constantes) },
    ecoles: ecolesReinitialisees(etat, constantes),
    sorts: sortsReinitialises(etat),
    combat: { zone, vague: VAGUE_DEPART, phase: 'vague', cible: null, timerBossRestantMs: null },
    // Les paliers payés en or appartiennent au run, comme l'or lui-même (EXG-42) ; ceux payés en
    // Renommée sont à vie (EXG-43, EXG-10) et ne sont pas touchés.
    paliersAmeliorations: {},
    prestige: { ...etat.prestige, zoneMaxDuRun: zone },
  }

  // Un run qui démarre plus loin que la zone 1 (nœud « zone de départ ») ne doit pas rester bloqué
  // derrière les révélations des boss qu'il vient de sauter (EXG-8).
  const revele = revelerEcolesDeZone(vierge, zone - 1, constantes)
  return synchroniserAutoCast(revele, constantes)
}

/* ═══════════════════════════════════════════ EXG-21 — confirmation à deux étapes du prestige */

/**
 * EXG-21, étape 1 — prévisualisation **en lecture seule** : ce que le joueur gagnerait et ce qu'il
 * perdrait. Cette fonction ne construit aucun état et ne retourne aucun état : elle ne peut, par
 * construction, rien modifier. L'étape 2 est `prestiger`, une fonction distincte.
 */
export function apercuPrestige(etat: EtatJeu, constantes: Constantes): ApercuPrestige {
  // EXG-28 / EXG-44 — une partie terminée ne prestige plus (la condition de fin est posée en T-13).
  const disponible = !etat.partieTerminee
  return {
    disponible,
    motifIndisponible: disponible ? null : 'verrouille',
    eclatsGagnes: eclatsAuPrestige(etat.prestige.zoneMaxDuRun, constantes),
    zoneMaxDuRun: etat.prestige.zoneMaxDuRun,
    perte: perteDeRun(etat),
    zoneReprise: zoneDepartRun(etat, constantes),
    orDeDepart: orDepartRun(etat, constantes),
  }
}

/**
 * EXG-19, étape 2 — applique le prestige : crédite les Éclats sur les **deux** compteurs (ADR-8),
 * incrémente le compteur de prestiges du cycle (il pilote la disponibilité de l'Ascension, EXG-20) et
 * celui à vie, cumule les Éclats gagnés (ils pilotent les Points d'Ascension, §8), puis réinitialise le
 * run. Un refus rend l'état d'entrée **par référence**, sans rien débiter.
 */
export function prestiger(etat: EtatJeu, constantes: Constantes): ResultatReinitialisation {
  const apercu = apercuPrestige(etat, constantes)
  if (!apercu.disponible) {
    return { etat, accepte: false, motifRefus: apercu.motifIndisponible, gain: 0 }
  }

  const gain = apercu.eclatsGagnes
  const credite: EtatJeu = {
    ...etat,
    bourse: {
      ...etat.bourse,
      eclatsPossedes: sommeBornee(etat.bourse.eclatsPossedes, gain),
      eclatsDepensables: sommeBornee(etat.bourse.eclatsDepensables, gain),
    },
    prestige: {
      ...etat.prestige,
      prestigesDuCycle: etat.prestige.prestigesDuCycle + 1,
      prestigesTotal: etat.prestige.prestigesTotal + 1,
      eclatsCumulesAVie: sommeBornee(etat.prestige.eclatsCumulesAVie, gain),
    },
  }

  return {
    etat: reinitialiserRun(credite, constantes),
    accepte: true,
    motifRefus: null,
    gain,
  }
}
