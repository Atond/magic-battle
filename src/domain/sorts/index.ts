// Sorts actifs — T-4 : sort de clic sans cooldown (EXG-11), sorts à cooldown (EXG-12), auto-cast
// (mécanisme d'EXG-40, dont le nœud d'achat arrive en T-7), verrou de la 6e école (EXG-13, EXG-41).
//
// Logique **pure** : aucun clavier, aucun événement ; T-20 branchera les touches 1 à 6 sur ces fonctions.
// Un déclenchement refusé retourne l'état d'entrée tel quel — aucune ressource consommée (EXG-12).

import { ecoleAccessible } from '../ecoles/index.ts'
import type {
  Constantes,
  EtatJeu,
  EtatSort,
  MotifRefus,
  ParametresSort,
  ResultatDeclenchement,
} from '../types.ts'

/* ─────────────────────────────────────────────────────────── lecture de l'état d'un sort */

/** Descripteur d'un sort dans le contrat, ou `undefined` si l'identifiant est inconnu. */
function parametresSort(idSort: string, constantes: Constantes): ParametresSort | undefined {
  return constantes.sorts.find((sort) => sort.id === idSort)
}

/**
 * §5 — « une École débloque un Sort » : la disponibilité d'un sort suit l'école qui le porte (EXG-7),
 * verrou d'Ascension compris (EXG-41 pour la touche 6).
 */
export function sortDisponible(etat: EtatJeu, idSort: string, constantes: Constantes): boolean {
  const parametres = parametresSort(idSort, constantes)
  if (parametres === undefined) return false
  const ecole = etat.ecoles[parametres.idEcole]
  if (ecole === undefined || !ecole.debloquee) return false
  return ecoleAccessible(etat, parametres.idEcole, constantes)
}

/**
 * État d'un sort tel que l'UI doit le lire (T-20) : le cooldown restant et l'auto-cast viennent de
 * l'état persisté quand ils y sont, `debloque` est toujours **dérivé** de l'école (une seule source de
 * vérité). Un sort jamais déclenché n'a pas d'entrée dans l'état : il est simplement prêt.
 */
export function etatSortLu(etat: EtatJeu, idSort: string, constantes: Constantes): EtatSort {
  const stocke = etat.sorts[idSort]
  return {
    debloque: sortDisponible(etat, idSort, constantes),
    cooldownRestantMs: stocke === undefined ? 0 : Math.max(stocke.cooldownRestantMs, 0),
    autoCast: stocke?.autoCast ?? false,
  }
}

/* ────────────────────────────────────────────────────────────── dégâts (EXG-11, §8) */

/**
 * §8 — `Σ bonus_améliorations` : somme **linéaire** des bonus des paliers achetés, chaque palier valant
 * `effet_mult − 1`. À ne pas confondre avec `mult_améliorations` de la chaîne de DPS, qui en est le
 * produit (EXG-42) : le clic suit la forme additive donnée par §8.
 */
export function bonusAmeliorations(etat: EtatJeu, constantes: Constantes): number {
  let bonus = 0
  for (const amelioration of constantes.ameliorations) {
    const paliers = etat.paliersAmeliorations[amelioration.id] ?? 0
    if (paliers > 0) bonus += paliers * (amelioration.effetMult - 1)
  }
  return bonus
}

/** EXG-11 — `D_clic = base_clic × (1 + Σ bonus_améliorations)`, sans cooldown ni ressource. */
export function degatsClic(etat: EtatJeu, constantes: Constantes): number {
  return constantes.or.baseClic * (1 + bonusAmeliorations(etat, constantes))
}

/**
 * Dégâts instantanés d'un sort : `dégâts_base × mult_améliorations × mult_équipement`, les deux facteurs
 * d'achats de la chaîne de DPS (§8). Les facteurs de méta (Éclats, arbres) restent hors du sort tant que
 * T-6/T-7 ne les ont pas branchés.
 */
export function degatsSort(parametres: ParametresSort, multiplicateurAchats: number): number {
  return parametres.degatsBase * multiplicateurAchats
}

/* ────────────────────────────────────────────────────── déclenchement & cooldown (EXG-12) */

/** Écrit l'entrée d'état d'un sort qui vient de partir : cooldown armé à la valeur du contrat. */
function armerCooldown(etat: EtatJeu, parametres: ParametresSort): EtatJeu {
  const precedent = etat.sorts[parametres.id]
  return {
    ...etat,
    sorts: {
      ...etat.sorts,
      [parametres.id]: {
        debloque: true,
        cooldownRestantMs: parametres.cooldownMs,
        autoCast: precedent?.autoCast ?? false,
      },
    },
  }
}

/**
 * EXG-12 — déclenche un sort actif s'il est débloqué et hors cooldown. Sinon : refus motivé, état
 * d'entrée rendu **tel quel** (aucune ressource consommée) et temps restant toujours lisible via
 * `etatSortLu`. Cette fonction ne connaît pas le combat : elle renvoie les dégâts à appliquer.
 */
export function declencherSort(
  etat: EtatJeu,
  idSort: string,
  constantes: Constantes,
  multiplicateurAchats = 1,
): ResultatDeclenchement {
  const refuser = (motifRefus: MotifRefus): ResultatDeclenchement => ({
    etat,
    declenche: false,
    motifRefus,
    degats: 0,
  })

  const parametres = parametresSort(idSort, constantes)
  if (parametres === undefined) return refuser('inconnu')
  if (!sortDisponible(etat, idSort, constantes)) return refuser('verrouille')
  if (etatSortLu(etat, idSort, constantes).cooldownRestantMs > 0) return refuser('enCooldown')

  return {
    etat: armerCooldown(etat, parametres),
    declenche: true,
    motifRefus: null,
    degats: degatsSort(parametres, multiplicateurAchats),
  }
}

/**
 * EXG-12 / EXG-40 — un pas de temps côté sorts : les cooldowns décroissent de `dtMs` (jamais sous zéro),
 * puis tout sort à `autoCast` armé et prêt part de lui-même, sans clic. Retourne les dégâts instantanés
 * cumulés du pas, que le tick verse au combat.
 * Coût borné par le nombre de sorts du contrat (six touches), jamais par l'historique (EXG-30).
 */
export function avancerSorts(
  etat: EtatJeu,
  dtMs: number,
  constantes: Constantes,
  multiplicateurAchats = 1,
): { etat: EtatJeu; degats: number } {
  const ecoule = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0

  let sorts = etat.sorts
  let modifie = false
  for (const [id, sort] of Object.entries(etat.sorts)) {
    const restant = Math.max(sort.cooldownRestantMs - ecoule, 0)
    if (restant !== sort.cooldownRestantMs) {
      sorts = { ...sorts, [id]: { ...sort, cooldownRestantMs: restant } }
      modifie = true
    }
  }

  let courant: EtatJeu = modifie ? { ...etat, sorts } : etat
  let degats = 0
  for (const parametres of constantes.sorts) {
    const sort = courant.sorts[parametres.id]
    if (sort === undefined || !sort.autoCast) continue
    const tir = declencherSort(courant, parametres.id, constantes, multiplicateurAchats)
    if (!tir.declenche) continue
    courant = tir.etat
    degats += tir.degats
  }

  return { etat: courant, degats }
}
