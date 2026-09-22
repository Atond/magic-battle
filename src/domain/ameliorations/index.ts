// Achats multiplicatifs à paliers — T-8 : améliorations payées en or (EXG-42) et équipement payé en
// Renommée (EXG-43) partagent exactement la même mécanique, donc le même moteur de calcul :
//   coût du palier n+1 = `coût_base × croissance^n`  (même famille que les écoles, EXG-9)
//   multiplicateur      = **produit** des `effet_mult` des paliers achetés (chaîne de DPS §8)
//
// EXG-10 — la monnaie est portée par le descripteur d'achat et vérifiée à chaque transaction : l'or ne
// se substitue jamais à la Renommée, ni l'inverse. Les deux guichets (`acheterAmelioration`,
// `acheterEquipement`) passent par la même vérification, il n'y a donc pas de porte dérobée.

import { rangSain, sommeGeometrique } from '../ecoles/serie-geometrique.ts'
import type {
  Constantes,
  EtatJeu,
  MonnaieAchat,
  MotifRefus,
  ParametresAchatMultiplicatif,
  ResultatAchat,
} from '../types.ts'

/* ────────────────────────────────────────────────────────────────────── coûts (EXG-42, EXG-43) */

/** EXG-42 / EXG-43 — coût du palier `palier + 1` : `coût_base × croissance^palier`. */
export function coutPalier(palier: number, parametres: ParametresAchatMultiplicatif): number {
  return parametres.coutBase * parametres.croissance ** rangSain(palier)
}

/** Coût de `quantite` paliers achetés d'un coup, en forme fermée (même série que les écoles). */
export function coutPaliers(
  palier: number,
  quantite: number,
  parametres: ParametresAchatMultiplicatif,
): number {
  return sommeGeometrique(coutPalier(palier, parametres), parametres.croissance, quantite)
}

/* ──────────────────────────────────────────────────── multiplicateurs de la chaîne de DPS (§8) */

/** Produit des `effet_mult` des paliers achetés dans une liste d'achats donnée. */
export function multiplicateurAchats(
  paliers: Readonly<Record<string, number>>,
  liste: readonly ParametresAchatMultiplicatif[],
): number {
  let multiplicateur = 1
  for (const achat of liste) {
    const nombre = rangSain(paliers[achat.id] ?? 0)
    if (nombre > 0) multiplicateur *= achat.effetMult ** nombre
  }
  return multiplicateur
}

/** EXG-42 — `mult_améliorations` de la chaîne de DPS §8. */
export function multAmeliorations(etat: EtatJeu, constantes: Constantes): number {
  return multiplicateurAchats(etat.paliersAmeliorations, constantes.ameliorations)
}

/** EXG-43 — `mult_équipement` de la chaîne de DPS §8. */
export function multEquipement(etat: EtatJeu, constantes: Constantes): number {
  return multiplicateurAchats(etat.paliersEquipement, constantes.equipement)
}

/** Produit des deux facteurs d'achats : utilisé aussi par les dégâts instantanés des sorts (T-4). */
export function multiplicateursAchats(etat: EtatJeu, constantes: Constantes): number {
  return multAmeliorations(etat, constantes) * multEquipement(etat, constantes)
}

/* ────────────────────────────────────────────────────────────────── achat (EXG-10, 42, 43) */

/** Cherche un descripteur d'achat dans les deux listes du contrat (améliorations puis équipement). */
function trouverAchat(id: string, constantes: Constantes): ParametresAchatMultiplicatif | undefined {
  return (
    constantes.ameliorations.find((achat) => achat.id === id) ??
    constantes.equipement.find((achat) => achat.id === id)
  )
}

/** Solde de la monnaie demandée. */
function solde(etat: EtatJeu, monnaie: MonnaieAchat): number {
  return monnaie === 'or' ? etat.bourse.or : etat.bourse.renommee
}

/** Paliers déjà achetés, rangés par monnaie : l'or alimente les améliorations, la Renommée l'équipement. */
function paliersDe(etat: EtatJeu, monnaie: MonnaieAchat): Readonly<Record<string, number>> {
  return monnaie === 'or' ? etat.paliersAmeliorations : etat.paliersEquipement
}

/** Débite la monnaie et inscrit le nouveau palier, sans jamais mélanger les deux dictionnaires. */
function appliquerAchat(
  etat: EtatJeu,
  achat: ParametresAchatMultiplicatif,
  palierSuivant: number,
  cout: number,
): EtatJeu {
  if (achat.monnaie === 'or') {
    return {
      ...etat,
      bourse: { ...etat.bourse, or: etat.bourse.or - cout },
      paliersAmeliorations: { ...etat.paliersAmeliorations, [achat.id]: palierSuivant },
    }
  }
  return {
    ...etat,
    bourse: { ...etat.bourse, renommee: etat.bourse.renommee - cout },
    paliersEquipement: { ...etat.paliersEquipement, [achat.id]: palierSuivant },
  }
}

/**
 * EXG-10 / EXG-42 / EXG-43 — achète un palier avec `monnaiePayee`. Refuse, sans rien modifier :
 *  - un identifiant inconnu (`inconnu`) ;
 *  - une monnaie qui n'est pas celle de l'achat (`mauvaiseMonnaie` : l'or n'achète pas d'équipement,
 *    la Renommée n'achète pas d'amélioration) ;
 *  - un solde insuffisant dans la **bonne** monnaie (`monnaieInsuffisante`) ;
 *  - un plafond de paliers atteint (`paliersMaxAtteints`).
 */
export function acheterPalier(
  etat: EtatJeu,
  id: string,
  monnaiePayee: MonnaieAchat,
  constantes: Constantes,
): ResultatAchat {
  const refuser = (motifRefus: MotifRefus): ResultatAchat => ({
    etat,
    accepte: false,
    motifRefus,
    coutPaye: 0,
    quantite: 0,
  })

  const achat = trouverAchat(id, constantes)
  if (achat === undefined) return refuser('inconnu')
  if (achat.monnaie !== monnaiePayee) return refuser('mauvaiseMonnaie')

  const palier = rangSain(paliersDe(etat, achat.monnaie)[id] ?? 0)
  if (achat.paliersMax !== null && palier >= achat.paliersMax) return refuser('paliersMaxAtteints')

  const cout = coutPalier(palier, achat)
  if (!Number.isFinite(cout) || cout > solde(etat, achat.monnaie)) return refuser('monnaieInsuffisante')

  return {
    etat: appliquerAchat(etat, achat, palier + 1, cout),
    accepte: true,
    motifRefus: null,
    coutPaye: cout,
    quantite: 1,
  }
}

/** EXG-42 — guichet des améliorations : paie en or, et en or seulement. */
export function acheterAmelioration(etat: EtatJeu, id: string, constantes: Constantes): ResultatAchat {
  return acheterPalier(etat, id, 'or', constantes)
}
