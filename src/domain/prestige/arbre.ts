// Mécanique générique des arbres de méta — le guichet commun à l'arbre d'Éclats (EXG-39) et à l'arbre
// d'Ascension (EXG-40). Les deux arbres ont exactement la même mécanique (rangs, coût croissant, rangs
// bornés ou infinis, prérequis) et ne diffèrent que par la monnaie et par le dictionnaire de rangs qui
// les stocke : un seul moteur de calcul, donc aucune divergence possible entre les deux (même esprit que
// `ameliorations/` pour l'or et la Renommée).
//
// Trois exigences tenues ici :
//  1. aucune valeur d'équilibrage — l'échelle de coût `(coutBaseNoeud, croissanceCoutNoeud)` est portée
//     par l'arbre dans `Constantes`, le poids du nœud par son descripteur (§8) ;
//  2. coût cumulé et nombre de rangs achetables en **forme fermée** (puissance, logarithme) : acheter
//     un milliard de rangs d'un nœud répétable coûte le même temps de calcul qu'un seul (EXG-30) ;
//  3. aucun nœud connu par son identifiant : le catalogue est une donnée, le moteur le parcourt.
//
// Ce fichier est hébergé sous `prestige/` parce que l'arbre d'Éclats en est le premier usager ; il ne
// dépend d'aucune notion de prestige et se lit comme une bibliothèque d'arbre (même parti que
// `ecoles/serie-geometrique.ts`).

import { FACTEUR_NEUTRE } from '../constantes-moteur.ts'
import { rangSain, sommeGeometrique, termesAchetables } from '../ecoles/serie-geometrique.ts'
import { nombreFini } from './nombres.ts'
import type {
  Constantes,
  EtatJeu,
  IdArbre,
  MotifRefus,
  ParametresNoeudArbre,
  ResultatAchat,
  TypeEffetNoeud,
} from '../types.ts'

/* ─────────────────────────────────────────────────────────────────────── lecture du catalogue */

/** Échelle de coût de l'arbre : premier terme et raison de la série géométrique de ses rangs (§8). */
function echelleCout(arbre: IdArbre, constantes: Constantes): { coutBase: number; croissance: number } {
  const source = arbre === 'eclats' ? constantes.prestige : constantes.ascension
  return { coutBase: source.coutBaseNoeud, croissance: source.croissanceCoutNoeud }
}

/** EXG-39 / EXG-40 — nœuds d'un arbre donné, dans l'ordre du catalogue. */
export function noeudsDeLArbre(arbre: IdArbre, constantes: Constantes): readonly ParametresNoeudArbre[] {
  return constantes.noeuds.filter((noeud) => noeud.arbre === arbre)
}

/** Descripteur d'un nœud, ou `undefined` si l'identifiant est absent du catalogue. */
export function noeudParId(id: string, constantes: Constantes): ParametresNoeudArbre | undefined {
  return constantes.noeuds.find((noeud) => noeud.id === id)
}

/** Dictionnaire de rangs de l'arbre : celui du cycle pour les Éclats, le permanent pour l'Ascension. */
export function rangsDeLArbre(etat: EtatJeu, arbre: IdArbre): Readonly<Record<string, number>> {
  return arbre === 'eclats' ? etat.prestige.rangsArbreEclats : etat.ascension.rangsArbreAscension
}

/** Rang acheté d'un nœud (0 s'il n'a jamais été touché). */
export function rangNoeud(etat: EtatJeu, noeud: ParametresNoeudArbre): number {
  return rangSain(rangsDeLArbre(etat, noeud.arbre)[noeud.id] ?? 0)
}

/** Solde de la monnaie du nœud : Éclats dépensables (EXG-39) ou Points d'Ascension (EXG-40). */
function soldeArbre(etat: EtatJeu, arbre: IdArbre): number {
  return arbre === 'eclats' ? etat.bourse.eclatsDepensables : etat.bourse.pointsAscension
}

/* ────────────────────────────────────────────────────────────── coûts (forme fermée, EXG-30) */

/** §8 — coût du rang `rang` (0-indexé) : `coutBaseNoeud × coutRelatif × croissanceCoutNoeud^rang`. */
export function coutRangNoeud(
  rang: number,
  noeud: ParametresNoeudArbre,
  constantes: Constantes,
): number {
  const { coutBase, croissance } = echelleCout(noeud.arbre, constantes)
  return coutBase * noeud.coutRelatif * croissance ** rangSain(rang)
}

/**
 * Coût de `quantite` rangs achetés d'un coup depuis `rang`, en **forme fermée** :
 * `premier × (raison^quantite − 1) / (raison − 1)` (et `× quantite` si `raison = 1`). Identique à la
 * somme itérée des coûts unitaires, sans jamais itérer les rangs.
 */
export function coutRangsNoeud(
  rang: number,
  quantite: number,
  noeud: ParametresNoeudArbre,
  constantes: Constantes,
): number {
  const { croissance } = echelleCout(noeud.arbre, constantes)
  return sommeGeometrique(coutRangNoeud(rang, noeud, constantes), croissance, quantite)
}

/**
 * Nombre de rangs qu'un `budget` permet d'acheter depuis `rang`, en forme fermée (logarithme), plafonné
 * par `rangMax` quand le nœud en a un. Jamais une boucle d'achats successifs, même avec un solde
 * astronomique en fin de cycle (EXG-30).
 */
export function rangsAchetablesNoeud(
  rang: number,
  budget: number,
  noeud: ParametresNoeudArbre,
  constantes: Constantes,
): number {
  const { croissance } = echelleCout(noeud.arbre, constantes)
  const possibles = termesAchetables(coutRangNoeud(rang, noeud, constantes), croissance, budget)
  if (noeud.rangMax === null) return possibles
  return Math.min(possibles, Math.max(noeud.rangMax - rangSain(rang), 0))
}

/* ───────────────────────────────────────────────────────────── effets agrégés (chaîne §8) */

/** Produit des `effetParRang^rang` des nœuds d'une liste portant l'effet demandé. */
function facteurSurNoeuds(
  etat: EtatJeu,
  noeuds: readonly ParametresNoeudArbre[],
  effet: TypeEffetNoeud,
): number {
  let facteur = FACTEUR_NEUTRE
  for (const noeud of noeuds) {
    if (noeud.effet !== effet) continue
    const rang = rangNoeud(etat, noeud)
    if (rang > 0) facteur *= noeud.effetParRang ** rang
  }
  // Un nœud répétable poussé à des rangs astronomiques déborde le double : on sature au lieu de laisser
  // fuir `Infinity` dans la chaîne de DPS (§8) — c'est le seuil que le simulateur doit voir (EXG-37).
  return nombreFini(facteur)
}

/** Somme des `effetParRang × rang` des nœuds d'une liste portant l'effet demandé (effets additifs). */
function sommeSurNoeuds(
  etat: EtatJeu,
  noeuds: readonly ParametresNoeudArbre[],
  effet: TypeEffetNoeud,
): number {
  let somme = 0
  for (const noeud of noeuds) {
    if (noeud.effet !== effet) continue
    const rang = rangNoeud(etat, noeud)
    if (rang > 0) somme += noeud.effetParRang * rang
  }
  return nombreFini(somme)
}

/** Facteur multiplicatif d'un effet, sur un seul arbre (`mult_arbre_Éclats`, `mult_arbre_Ascension`). */
export function facteurArbre(
  etat: EtatJeu,
  arbre: IdArbre,
  effet: TypeEffetNoeud,
  constantes: Constantes,
): number {
  return facteurSurNoeuds(etat, noeudsDeLArbre(arbre, constantes), effet)
}

/** Facteur multiplicatif d'un effet, tous arbres confondus (or, cooldowns : les deux arbres y jouent). */
export function facteurTousArbres(
  etat: EtatJeu,
  effet: TypeEffetNoeud,
  constantes: Constantes,
): number {
  return facteurSurNoeuds(etat, constantes.noeuds, effet)
}

/** Somme additive d'un effet, sur un seul arbre. */
export function sommeArbre(
  etat: EtatJeu,
  arbre: IdArbre,
  effet: TypeEffetNoeud,
  constantes: Constantes,
): number {
  return sommeSurNoeuds(etat, noeudsDeLArbre(arbre, constantes), effet)
}

/** Somme additive d'un effet, tous arbres confondus (zone de départ, or de départ). */
export function sommeTousArbres(
  etat: EtatJeu,
  effet: TypeEffetNoeud,
  constantes: Constantes,
): number {
  return sommeSurNoeuds(etat, constantes.noeuds, effet)
}

/* ────────────────────────────────────────────────────── effets structurels (EXG-40 auto-cast) */

/**
 * EXG-40 — dérive l'auto-cast des sorts depuis les **rangs** des nœuds qui le portent : un nœud acheté
 * arme `EtatSort.autoCast`, et le sort part ensuite de lui-même au tick suivant (`avancerSorts`), sans
 * clic ni frappe. Les rangs sont la seule source de vérité : rejouer cette fonction après une
 * réinitialisation (EXG-19, EXG-20) ou une reprise de sauvegarde (T-10) suffit à remettre les drapeaux
 * d'aplomb, dans les deux sens.
 * Retourne l'état d'entrée tel quel quand rien ne change (pas de nouvel objet inutile pour l'UI).
 */
export function synchroniserAutoCast(etat: EtatJeu, constantes: Constantes): EtatJeu {
  const voulu = new Map<string, boolean>()
  for (const noeud of constantes.noeuds) {
    if (noeud.effet !== 'autoCast' || noeud.idSortCible === null) continue
    const arme = rangNoeud(etat, noeud) > 0
    voulu.set(noeud.idSortCible, (voulu.get(noeud.idSortCible) ?? false) || arme)
  }

  let sorts = etat.sorts
  let modifie = false
  for (const [idSort, arme] of voulu) {
    const precedent = sorts[idSort]
    if ((precedent?.autoCast ?? false) === arme) continue
    sorts = {
      ...sorts,
      [idSort]: {
        debloque: precedent?.debloque ?? false,
        cooldownRestantMs: precedent?.cooldownRestantMs ?? 0,
        autoCast: arme,
      },
    }
    modifie = true
  }
  return modifie ? { ...etat, sorts } : etat
}

/* ─────────────────────────────────────────────────────────────────────────── achat d'un nœud */

/** Écrit le nouveau rang et débite la monnaie de l'arbre, sans jamais mélanger les deux dictionnaires. */
function appliquerAchat(
  etat: EtatJeu,
  noeud: ParametresNoeudArbre,
  rangSuivant: number,
  cout: number,
): EtatJeu {
  if (noeud.arbre === 'eclats') {
    return {
      ...etat,
      // ADR-8 — seul le solde dépensable est débité : `eclatsPossedes`, qui alimente le bonus passif
      // (EXG-38), n'est jamais réduit par une dépense dans l'arbre.
      bourse: { ...etat.bourse, eclatsDepensables: etat.bourse.eclatsDepensables - cout },
      prestige: {
        ...etat.prestige,
        rangsArbreEclats: { ...etat.prestige.rangsArbreEclats, [noeud.id]: rangSuivant },
      },
    }
  }
  return {
    ...etat,
    bourse: { ...etat.bourse, pointsAscension: etat.bourse.pointsAscension - cout },
    ascension: {
      ...etat.ascension,
      rangsArbreAscension: { ...etat.ascension.rangsArbreAscension, [noeud.id]: rangSuivant },
    },
  }
}

/** Tous les prérequis du nœud sont-ils possédés (rang ≥ 1) ? Un nœud racine n'en a aucun. */
export function prerequisRemplis(
  etat: EtatJeu,
  noeud: ParametresNoeudArbre,
  constantes: Constantes,
): boolean {
  for (const id of noeud.prerequis) {
    const requis = noeudParId(id, constantes)
    if (requis === undefined || rangNoeud(etat, requis) <= 0) return false
  }
  return true
}

/**
 * EXG-39 / EXG-40 — achète `quantite` rangs d'un nœud avec la monnaie de **son** arbre. Même guichet que
 * le lot B, à la monnaie près. Refuse, sans rien modifier (état d'entrée rendu par référence) :
 *  - un identifiant absent du catalogue (`inconnu`) ;
 *  - un nœud de l'autre arbre présenté à ce guichet (`mauvaiseMonnaie` : les Éclats n'achètent pas de
 *    Points d'Ascension, ni l'inverse) ;
 *  - une quantité nulle, négative ou non finie (`quantiteInvalide`) ;
 *  - des prérequis non remplis (`verrouille`) ;
 *  - un rang maximal déjà atteint, ou une quantité qui le dépasserait (`paliersMaxAtteints` : l'achat
 *    est refusé **en bloc**, jamais tronqué en silence) ;
 *  - un solde insuffisant dans la monnaie de l'arbre (`monnaieInsuffisante`).
 */
export function acheterNoeudArbre(
  etat: EtatJeu,
  id: string,
  quantite: number,
  arbre: IdArbre,
  constantes: Constantes,
): ResultatAchat {
  const refuser = (motifRefus: MotifRefus): ResultatAchat => ({
    etat,
    accepte: false,
    motifRefus,
    coutPaye: 0,
    quantite: 0,
  })

  const noeud = noeudParId(id, constantes)
  if (noeud === undefined) return refuser('inconnu')
  if (noeud.arbre !== arbre) return refuser('mauvaiseMonnaie')

  const nombre = rangSain(quantite)
  if (nombre === 0) return refuser('quantiteInvalide')
  if (!prerequisRemplis(etat, noeud, constantes)) return refuser('verrouille')

  const rang = rangNoeud(etat, noeud)
  if (noeud.rangMax !== null && rang + nombre > noeud.rangMax) return refuser('paliersMaxAtteints')

  const cout = coutRangsNoeud(rang, nombre, noeud, constantes)
  if (!Number.isFinite(cout) || cout > soldeArbre(etat, arbre)) return refuser('monnaieInsuffisante')

  const paye = appliquerAchat(etat, noeud, rang + nombre, cout)
  return {
    etat: synchroniserAutoCast(paye, constantes),
    accepte: true,
    motifRefus: null,
    coutPaye: cout,
    quantite: nombre,
  }
}
