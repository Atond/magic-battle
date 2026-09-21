// Équipement — T-8 / EXG-43 : multiplicateur de dégâts acheté **exclusivement** en Renommée (EXG-10).
//
// La mécanique de paliers est partagée avec les améliorations (`ameliorations/`) : un seul moteur de
// calcul, une seule vérification de monnaie, donc aucune divergence possible entre les deux guichets.
// Ce module n'est que le guichet « Renommée » et les lectures dédiées à l'équipement.

import { acheterPalier, coutPalier, multEquipement } from '../ameliorations/index.ts'
import type { Constantes, EtatJeu, ParametresAchatMultiplicatif, ResultatAchat } from '../types.ts'

/** EXG-43 — coût du palier `palier + 1` d'un équipement : `coût_base × croissance^palier`. */
export function coutPalierEquipement(palier: number, parametres: ParametresAchatMultiplicatif): number {
  return coutPalier(palier, parametres)
}

/**
 * EXG-10 / EXG-43 — guichet de l'équipement : paie en Renommée, et en Renommée seulement. Un solde d'or,
 * même astronomique, ne débloque rien ici ; inversement, une amélioration présentée à ce guichet est
 * refusée pour `mauvaiseMonnaie`.
 */
export function acheterEquipement(etat: EtatJeu, id: string, constantes: Constantes): ResultatAchat {
  return acheterPalier(etat, id, 'renommee', constantes)
}

export { multEquipement }
