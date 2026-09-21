// Écoles de magie — T-3 : coûts croissants (EXG-9), production à paliers (§8), déblocage en deux temps
// (révélation par boss EXG-8, achat en or EXG-7). Module pur : l'état entre, un nouvel état sort.
//
// Aucune valeur d'équilibrage n'est écrite ici. Tout arrive par `ParametresEcole` (contrat `Constantes`),
// y compris la zone qui révèle chaque école et le verrou de la 6e école : le moteur ne teste jamais un
// identifiant d'école en dur.

import type {
  Constantes,
  EtatEcole,
  EtatJeu,
  IdEcole,
  ParametresEcole,
  ResultatAchat,
  MotifRefus,
} from '../types.ts'
import { rangSain, sommeGeometrique, termesAchetables } from './serie-geometrique.ts'

/* ─────────────────────────────────────────────────────────────────────────────── coûts (EXG-9) */

/** EXG-9 — coût du niveau `niveau + 1` : `coût_base × croissance^niveau`. */
export function coutProchainNiveau(niveau: number, parametres: ParametresEcole): number {
  return parametres.coutBase * parametres.croissance ** rangSain(niveau)
}

/**
 * EXG-9 — coût de `quantite` niveaux achetés d'un coup, en **forme fermée** :
 * `coût_base × r^niveau × (r^quantite − 1) / (r − 1)` (et `× quantite` si `r = 1`). Identique à la somme
 * itérée des coûts unitaires, sans itérer.
 */
export function coutNiveaux(niveau: number, quantite: number, parametres: ParametresEcole): number {
  return sommeGeometrique(coutProchainNiveau(niveau, parametres), parametres.croissance, quantite)
}

/**
 * Nombre de niveaux que `or` permet d'acheter depuis `niveau`, en forme fermée (logarithme) : jamais une
 * boucle d'achats successifs, même avec un or astronomique en fin de partie (EXG-30).
 */
export function niveauxAchetables(niveau: number, or: number, parametres: ParametresEcole): number {
  return termesAchetables(coutProchainNiveau(niveau, parametres), parametres.croissance, or)
}

/* ────────────────────────────────────────────────────────────────────── production passive (§8) */

/**
 * §8 — ×`multiplicateurParPalier` à chaque seuil de `paliersSeuils` franchi. Coût borné par le nombre de
 * seuils du contrat (une poignée), jamais par le niveau atteint.
 */
export function multiplicateurPalier(niveau: number, parametres: ParametresEcole): number {
  let paliersFranchis = 0
  for (const seuil of parametres.paliersSeuils) {
    if (niveau >= seuil) paliersFranchis += 1
  }
  return parametres.multiplicateurParPalier ** paliersFranchis
}

/**
 * §8 — production d'une école, en dégâts par seconde :
 * `niveau × production_base × multiplicateur_palier(niveau)`.
 * EXG-7 — une école non débloquée ne produit rien, quel que soit son niveau.
 */
export function productionEcole(etat: EtatEcole, parametres: ParametresEcole): number {
  if (!etat.debloquee || etat.niveau <= 0) return 0
  return etat.niveau * parametres.productionBase * multiplicateurPalier(etat.niveau, parametres)
}

/**
 * §8 — premier terme de la chaîne de DPS : `Σ(niveau × production_base × palier)` sur les écoles
 * **débloquées** de l'état. Parcourt le dictionnaire de l'état, jamais une liste en dur (EXG-7).
 */
export function productionEcoles(etat: EtatJeu, constantes: Constantes): number {
  let production = 0
  for (const [id, ecole] of Object.entries(etat.ecoles) as [IdEcole, EtatEcole][]) {
    const parametres = constantes.ecoles[id]
    if (parametres === undefined) continue
    production += productionEcole(ecole, parametres)
  }
  return production
}

/* ──────────────────────────────────────────────────────── déblocage (EXG-7, EXG-8, EXG-41) */

/**
 * Une école est **accessible à l'achat** si elle est révélée (EXG-8) et si son éventuel verrou
 * d'Ascension est levé (EXG-41 : la 6e école reste hors du circuit avant la 1re Ascension ; le drapeau
 * `sixiemeEcoleDebloquee` est posé par T-7).
 */
export function ecoleAccessible(etat: EtatJeu, id: IdEcole, constantes: Constantes): boolean {
  const parametres = constantes.ecoles[id]
  const ecole = etat.ecoles[id]
  if (parametres === undefined || ecole === undefined) return false
  if (parametres.requiertAscension && !etat.ascension.sixiemeEcoleDebloquee) return false
  return ecole.revelee
}

/**
 * EXG-8 — le boss de `zoneVaincue` révèle les écoles dont `zoneRevelation` est atteinte : nom et coût
 * de déblocage deviennent visibles, la production reste masquée jusqu'à l'achat du 1er niveau (EXG-7).
 * Les écoles à verrou d'Ascension ne sont jamais révélées par un boss (EXG-41).
 * Retourne l'état d'entrée tel quel si rien ne change (pas de nouvel objet inutile pour l'UI).
 */
export function revelerEcolesDeZone(etat: EtatJeu, zoneVaincue: number, constantes: Constantes): EtatJeu {
  if (!Number.isFinite(zoneVaincue)) return etat

  let ecoles = etat.ecoles
  let modifie = false
  for (const [id, ecole] of Object.entries(etat.ecoles) as [IdEcole, EtatEcole][]) {
    const parametres = constantes.ecoles[id]
    if (parametres === undefined || ecole.revelee) continue
    if (parametres.requiertAscension || parametres.zoneRevelation === null) continue
    if (zoneVaincue < parametres.zoneRevelation) continue
    ecoles = { ...ecoles, [id]: { ...ecole, revelee: true } }
    modifie = true
  }
  return modifie ? { ...etat, ecoles } : etat
}

/* ─────────────────────────────────────────────────────────────────────────────────────── achat */

/**
 * EXG-8 / EXG-9 — achète `quantite` niveaux d'une école contre de l'or. Le premier niveau payé débloque
 * l'école (elle entre alors dans le total de dégâts, EXG-7). Tout refus renvoie l'état d'entrée **tel
 * quel** : aucune monnaie débitée, aucun niveau gagné.
 */
export function acheterNiveaux(
  etat: EtatJeu,
  id: IdEcole,
  quantite: number,
  constantes: Constantes,
): ResultatAchat {
  const refuser = (motifRefus: MotifRefus): ResultatAchat => ({
    etat,
    accepte: false,
    motifRefus,
    coutPaye: 0,
    quantite: 0,
  })

  const parametres = constantes.ecoles[id]
  const ecole = etat.ecoles[id]
  if (parametres === undefined || ecole === undefined) return refuser('inconnu')
  if (!ecoleAccessible(etat, id, constantes)) return refuser('verrouille')

  const nombre = rangSain(quantite)
  if (nombre === 0) return refuser('quantiteInvalide')

  const cout = coutNiveaux(ecole.niveau, nombre, parametres)
  if (!Number.isFinite(cout) || cout > etat.bourse.or) return refuser('monnaieInsuffisante')

  return {
    etat: {
      ...etat,
      bourse: { ...etat.bourse, or: etat.bourse.or - cout },
      ecoles: { ...etat.ecoles, [id]: { ...ecole, niveau: ecole.niveau + nombre, debloquee: true } },
    },
    accepte: true,
    motifRefus: null,
    coutPaye: cout,
    quantite: nombre,
  }
}
