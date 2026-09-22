// Formules paramétriques des zones — T-5 : PV par vague (EXG-15), PV de boss, or par monstre (EXG-6),
// chrono de boss (EXG-16). Aucune valeur d'équilibrage ici : tout arrive par `Constantes` (§8).
//
// ADR-13 — les zones sont **générées par une formule paramétrique sans borne** : aucune liste de zones,
// aucun nombre de zones fixé, aucune borne de profondeur. Tout se calcule en forme fermée :
//   PV_base_vague1(z) = PV_base_vague1(1) × facteur_zone^(z−1)  avec
//   facteur_zone       = croissance_vague^(nb_vagues−1) × mult_boss × mult_zone_suivante
// ce qui évite la boucle « zone par zone » que le simulateur (T-14) appellerait des milliers de fois
// (EXG-30, budget de calcul §8).

import { MS_PAR_SECONDE, VAGUE_DEPART, ZONE_DEPART } from '../constantes-moteur.ts'
import { rangSain, sommeGeometrique, termesAchetables } from '../ecoles/serie-geometrique.ts'
import type { Boss, Constantes, Monstre } from '../types.ts'

/* ────────────────────────────────────────────────────────────── garde-fous d'entiers de jeu */

/** Numéro de zone sain : au moins la zone de départ, jamais `NaN`. */
export function zoneSaine(zone: number): number {
  return Number.isFinite(zone) && zone > ZONE_DEPART ? Math.floor(zone) : ZONE_DEPART
}

/** Nombre de vagues normales d'une zone, au moins 1 (une zone sans vague n'existe pas). */
export function nbVagues(constantes: Constantes): number {
  return Math.max(rangSain(constantes.zones.nbVagues), 1)
}

/** Numéro de vague sain, borné aux vagues normales de la zone. */
export function vagueSaine(vague: number, constantes: Constantes): number {
  const brut = Number.isFinite(vague) && vague > VAGUE_DEPART ? Math.floor(vague) : VAGUE_DEPART
  return Math.min(brut, nbVagues(constantes))
}

/** Dégâts sains : une valeur non finie ou négative ne fait rien plutôt que de tout casser. */
export function degatsSains(degats: number): number {
  return Number.isFinite(degats) && degats > 0 ? degats : 0
}

/* ───────────────────────────────────────────────────────────────────── PV (EXG-15, §8) */

/**
 * §8 — facteur de passage d'une zone à la suivante :
 * `croissance_vague^(nb_vagues−1) × mult_boss × mult_zone_suivante`. C'est lui qui compose la
 * profondeur ; le simulateur (T-14) le surveille pour éviter le mur mathématique de la v1 (ADR-10).
 */
export function facteurZone(constantes: Constantes): number {
  const { croissanceVague, multBoss, multZoneSuivante } = constantes.zones
  return croissanceVague ** (nbVagues(constantes) - 1) * multBoss * multZoneSuivante
}

/**
 * §8 — PV du premier monstre de la zone `zone`, en **forme fermée** :
 * `PV_base_vague1(1) × facteur_zone^(zone−1)`. Aucune boucle sur les zones (EXG-30).
 */
export function pvBaseVague1(zone: number, constantes: Constantes): number {
  return constantes.zones.pvBaseVague1Zone1 * facteurZone(constantes) ** (zoneSaine(zone) - ZONE_DEPART)
}

/** EXG-15 — `PV(z, k) = PV_base_vague1(z) × croissance_vague^(k−1)`. */
export function pvVague(zone: number, vague: number, constantes: Constantes): number {
  return pvBaseVague1(zone, constantes) * constantes.zones.croissanceVague ** (vagueSaine(vague, constantes) - VAGUE_DEPART)
}

/** §8 — `PV_boss(z) = PV(z, nb_vagues) × mult_boss`. */
export function pvBoss(zone: number, constantes: Constantes): number {
  return pvVague(zone, nbVagues(constantes), constantes) * constantes.zones.multBoss
}

/** §8 — PV cumulés de `nombre` vagues consécutives à partir de `pvPremiere` (série géométrique fermée). */
export function pvCumulVagues(pvPremiere: number, nombre: number, constantes: Constantes): number {
  return sommeGeometrique(pvPremiere, constantes.zones.croissanceVague, nombre)
}

/**
 * EXG-30 — nombre de vagues qu'un budget de `degats` nettoie à partir d'une vague à `pvPremiere` PV :
 * `m = ⌊ log(1 + D × (r − 1) / PV) / log r ⌋`, obtenu par logarithme et non en itérant les monstres.
 * Un DPS de fin de partie (1e20) coûte donc exactement le même calcul qu'un DPS de 10.
 */
export function vaguesNettoyees(pvPremiere: number, degats: number, constantes: Constantes): number {
  return termesAchetables(pvPremiere, constantes.zones.croissanceVague, degatsSains(degats))
}

/* ───────────────────────────────────────────────────────────────────────── or (EXG-6) */

/** §8 — `mult_or_zone(z) = croissance_or_par_zone^(z−1)`, croissant avec la profondeur. */
export function multOrZone(zone: number, constantes: Constantes): number {
  return constantes.or.croissanceOrParZone ** (zoneSaine(zone) - ZONE_DEPART)
}

/** EXG-6 — `Or = PV_monstre × or_par_dégât_moyen × mult_or_zone(z)`. */
export function orMonstre(pvMonstre: number, zone: number, constantes: Constantes): number {
  return pvMonstre * constantes.or.orParDegatMoyen * multOrZone(zone, constantes)
}

/**
 * EXG-6 (forme agrégée) — or produit par `degats` points de dégâts infligés dans la zone `zone`. C'est
 * l'identité `Σ PV_des_monstres_tués = dégâts convertis` appliquée à la formule par monstre ci-dessus :
 * elle donne au tick et au hors-ligne un crédit d'or à coût constant, sans compter les monstres un à un.
 */
export function orPourDegats(degats: number, zone: number, constantes: Constantes): number {
  return degats * constantes.or.orParDegatMoyen * multOrZone(zone, constantes)
}

/* ────────────────────────────────────────────────────────── monstres, boss (§5, EXG-16) */

/** EXG-16 — durée du combat de boss, en millisecondes. */
export function timerBossMs(constantes: Constantes): number {
  return constantes.zones.timerBossS * MS_PAR_SECONDE
}

/* ──────────────────────────────────────────────────────── boss final, zone dédiée (EXG-28) */

/**
 * EXG-28 — PV du boss final : `pvBoss(profondeur_équivalente) × mult_pv`. Ils ne se déduisent **pas**
 * de `fin.zoneBossFinal`, qui est le *nom* de la zone dédiée et non une profondeur : le boss final ne
 * vit pas sur l'échelle des zones, sinon on le croiserait pendant un run ordinaire (ADR-17, révision
 * du 2026-09-21). La formule de zone, elle, n'est pas dupliquée : on appelle `pvBoss`.
 */
export function pvBossFinal(constantes: Constantes): number {
  return pvBoss(constantes.fin.pvProfondeurEquivalente, constantes) * constantes.fin.pvMultiplicateur
}

/** EXG-16 / EXG-28 — durée du combat du boss final, en ms. Son chrono lui appartient. */
export function timerBossFinalMs(constantes: Constantes): number {
  return constantes.fin.timerBossFinalS * MS_PAR_SECONDE
}

/**
 * EXG-28 — le boss de la zone dédiée. `orAuMeurtre` vaut zéro, et ce n'est pas un oubli : la partie
 * s'arrête sur sa mort (EXG-44), et la zone dédiée n'ayant pas de place sur l'échelle des zones, son
 * `mult_or_zone` n'aurait aucun sens (il serait non fini). Le texte du boss est du contenu (vague 3).
 */
export function creerBossFinal(constantes: Constantes): Boss {
  const pvMax = pvBossFinal(constantes)
  return {
    nom: '',
    pvMax,
    pvCourants: pvMax,
    orAuMeurtre: 0,
    zone: constantes.fin.zoneBossFinal,
    estBoss: true,
    estFinal: true,
  }
}

/** §5 — monstre de la vague `vague` de la zone `zone`. `nom` reste vide : le texte est du contenu (T-25). */
export function creerMonstre(zone: number, vague: number, constantes: Constantes): Monstre {
  const pvMax = pvVague(zone, vague, constantes)
  return { nom: '', pvMax, pvCourants: pvMax, orAuMeurtre: orMonstre(pvMax, zone, constantes) }
}

/**
 * §5 / EXG-28 — boss de la zone `zone`.
 *
 * Le seul cas particulier est la zone dédiée (`fin.zoneBossFinal`) : ses PV suivent `pvBossFinal`, pas
 * `pvBoss(zone)`. Une comparaison d'entiers, celle-là même qui décidait déjà d'`estFinal` — le coût du
 * chemin chaud ne bouge pas (EXG-30), et la formule de zone n'est écrite qu'une fois.
 *
 * Que la progression n'y mène jamais ne tient pas à cette fonction : le combat final vit hors
 * d'`EtatCombat` (`EtatJeu.bossFinal`) et ne s'ouvre que par `fin/entrerZoneFinale`, sous le seuil
 * d'Ascensions d'EXG-28. Si un run ordinaire atteignait malgré tout ce numéro de zone — 999 zones
 * au-delà de tout ce que le simulateur mesure — il y trouverait ce même boss, pas un sosie.
 */
export function creerBoss(zone: number, constantes: Constantes): Boss {
  const numero = zoneSaine(zone)
  if (numero === constantes.fin.zoneBossFinal) return creerBossFinal(constantes)
  const pvMax = pvBoss(numero, constantes)
  return {
    nom: '',
    pvMax,
    pvCourants: pvMax,
    orAuMeurtre: orMonstre(pvMax, numero, constantes),
    zone: numero,
    estBoss: true,
    // Le cas `estFinal` a déjà été rendu ci-dessus : ici, c'est forcément un boss de progression.
    estFinal: false,
  }
}
