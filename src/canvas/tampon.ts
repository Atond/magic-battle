// Tampon borné de projectiles/impacts actifs (T-21, EXG-52, §8). Fonction pure et immuable — jamais de
// classe ni de mutation en place — pour rester testable sans DOM et sans canvas réel
// (`tests/ui/canvas-limite.test.ts`).

import { N_PROJECTILES_MAX } from './constantes.ts'
import type { DemandeEffet } from './deltas.ts'

export interface Projectile extends DemandeEffet {
  readonly id: number
}

export interface ResultatAjout {
  readonly tampon: readonly Projectile[]
  /** Prochain identifiant libre — à repasser au prochain appel pour ne jamais réutiliser un id. */
  readonly prochainId: number
}

/**
 * Ajoute `demandes` au tampon existant, plafonné à `N_PROJECTILES_MAX` (EXG-52). Au-delà, les entrées
 * les PLUS ANCIENNES sont supprimées en premier — jamais les plus récentes, sinon un joueur qui enchaîne
 * les clics ne verrait plus jamais rien apparaître. Aucune structure ici ne grandit sans borne : le
 * tableau retourné ne dépasse jamais `N_PROJECTILES_MAX` éléments, quel que soit le nombre de `demandes`
 * reçu (des dizaines de milliers sur une seule frame de rattrapage hors-ligne y compris).
 */
export function ajouterProjectiles(
  tampon: readonly Projectile[],
  demandes: readonly DemandeEffet[],
  prochainId: number,
): ResultatAjout {
  let id = prochainId
  const nouveaux: Projectile[] = demandes.map((demande) => {
    const projectile: Projectile = { ...demande, id }
    id += 1
    return projectile
  })
  const combine = [...tampon, ...nouveaux]
  const borne = combine.length > N_PROJECTILES_MAX ? combine.slice(combine.length - N_PROJECTILES_MAX) : combine
  return { tampon: borne, prochainId: id }
}
