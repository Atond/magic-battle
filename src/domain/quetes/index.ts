// Quêtes — T-9 / EXG-54 : un jalon atteint accomplit la quête **une seule fois** et crédite sa Renommée,
// dépensable uniquement en équipement (EXG-10).
//
// ADR-11 — il n'y a pas d'entité « succès » dans ce jeu : une quête en joue le rôle. Trois types de
// jalons seulement (`zoneAtteinte`, `monstresTues`, `premierPrestige`), lus dans le contrat `Constantes` :
// ajouter une quête est une écriture de contenu, jamais une modification du moteur.
//
// Coût : une passe sur la liste des quêtes du contrat (quelques dizaines d'entrées fixes), jamais sur
// l'historique de jeu (EXG-30).

import { ZONE_DEPART } from '../constantes-moteur.ts'
import type { Constantes, EtatJeu, ParametresQuete } from '../types.ts'

/** Nombre de prestiges à partir duquel le jalon « 1er prestige » est franchi. */
const PREMIER_PRESTIGE = 1

/** EXG-54 — une quête déjà accomplie ne l'est plus jamais « à nouveau ». */
export function queteAccomplie(etat: EtatJeu, idQuete: string): boolean {
  return etat.quetesAccomplies.includes(idQuete)
}

/** Profondeur atteinte à retenir : la zone courante ou la plus profonde du run (EXG-17 n'efface rien). */
function zoneAtteinte(etat: EtatJeu): number {
  return Math.max(etat.combat.zone, etat.prestige.zoneMaxDuRun, ZONE_DEPART)
}

/**
 * EXG-54 — le jalon d'une quête est-il franchi ? Trois cas, et aucun autre : zone atteinte, nombre de
 * monstres tués à vie, premier prestige effectué.
 */
export function jalonAtteint(etat: EtatJeu, quete: ParametresQuete): boolean {
  switch (quete.typeJalon) {
    case 'zoneAtteinte':
      return zoneAtteinte(etat) >= quete.seuil
    case 'monstresTues':
      return etat.magicien.monstresTues >= quete.seuil
    case 'premierPrestige':
      return etat.prestige.prestigesTotal >= PREMIER_PRESTIGE
  }
}

/**
 * EXG-54 / EXG-10 — parcourt les quêtes non encore accomplies, marque celles dont le jalon est franchi
 * et crédite leur Renommée **une seule fois**. Appelé par le tick : redéclencher le jalon ensuite ne
 * crédite plus rien, puisque l'identifiant figure alors dans `quetesAccomplies`.
 * Retourne l'état d'entrée tel quel quand rien n'est accompli (pas de nouvel état inutile pour l'UI).
 */
export function evaluerQuetes(
  etat: EtatJeu,
  constantes: Constantes,
): { etat: EtatJeu; accomplies: readonly string[]; renommeeGagnee: number } {
  const accomplies: string[] = []
  let renommeeGagnee = 0

  for (const quete of constantes.quetes) {
    if (queteAccomplie(etat, quete.id) || accomplies.includes(quete.id)) continue
    if (!jalonAtteint(etat, quete)) continue
    accomplies.push(quete.id)
    if (Number.isFinite(quete.renommeeGagnee) && quete.renommeeGagnee > 0) {
      renommeeGagnee += quete.renommeeGagnee
    }
  }

  if (accomplies.length === 0) return { etat, accomplies, renommeeGagnee: 0 }

  return {
    etat: {
      ...etat,
      bourse: { ...etat.bourse, renommee: etat.bourse.renommee + renommeeGagnee },
      quetesAccomplies: [...etat.quetesAccomplies, ...accomplies],
    },
    accomplies,
    renommeeGagnee,
  }
}
