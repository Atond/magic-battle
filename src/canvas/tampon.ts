// Tampon borné de projectiles/impacts actifs (T-21, EXG-52, §8). Fonction pure et immuable — jamais de
// classe ni de mutation en place — pour rester testable sans DOM et sans canvas réel
// (`tests/ui/canvas-limite.test.ts`).

import { DUREE_VIE_PROJECTILE_MS, N_PROJECTILES_MAX } from './constantes.ts'
import type { DemandeEffet } from './deltas.ts'

export interface Projectile extends DemandeEffet {
  readonly id: number
  /** Instant (même horloge que `maintenantMs` passé à `ajouterProjectiles`/`purgerExpires`) au-delà
   *  duquel ce projectile doit disparaître, plutôt que de rester figé à l'écran indéfiniment. */
  readonly expireA: number
}

export interface ResultatAjout {
  readonly tampon: readonly Projectile[]
  /** Prochain identifiant libre — à repasser au prochain appel pour ne jamais réutiliser un id. */
  readonly prochainId: number
}

/** Retire du tampon tout projectile dont la durée de vie est dépassée (EXG-52 : un tampon rarement
 *  renouvelé ne doit pas garder éternellement les mêmes cercles figés à l'écran). Pure, déterministe :
 *  ne dépend que de `maintenantMs` passé en paramètre, jamais d'une horloge lue directement. */
export function purgerExpires(tampon: readonly Projectile[], maintenantMs: number): readonly Projectile[] {
  return tampon.filter((projectile) => projectile.expireA > maintenantMs)
}

/**
 * Ajoute `demandes` au tampon existant, plafonné à `N_PROJECTILES_MAX` (EXG-52). Au-delà, les entrées
 * les PLUS ANCIENNES sont supprimées en premier — jamais les plus récentes, sinon un joueur qui enchaîne
 * les clics ne verrait plus jamais rien apparaître. Aucune structure ici ne grandit sans borne : le
 * tableau retourné ne dépasse jamais `N_PROJECTILES_MAX` éléments, quel que soit le nombre de `demandes`
 * reçu (des dizaines de milliers sur une seule frame de rattrapage hors-ligne y compris). Purge aussi les
 * entrées expirées (`purgerExpires`) avant d'ajouter les nouvelles, sur la même horloge `maintenantMs`
 * (par défaut `0`, horloge figée — un appelant qui ne s'en sert pas ne voit donc jamais rien expirer).
 */
export function ajouterProjectiles(
  tampon: readonly Projectile[],
  demandes: readonly DemandeEffet[],
  prochainId: number,
  maintenantMs = 0,
): ResultatAjout {
  let id = prochainId
  const expireA = maintenantMs + DUREE_VIE_PROJECTILE_MS
  const nouveaux: Projectile[] = demandes.map((demande) => {
    const projectile: Projectile = { ...demande, id, expireA }
    id += 1
    return projectile
  })
  const vivants = purgerExpires(tampon, maintenantMs)
  const combine = [...vivants, ...nouveaux]
  const borne = combine.length > N_PROJECTILES_MAX ? combine.slice(combine.length - N_PROJECTILES_MAX) : combine
  return { tampon: borne, prochainId: id }
}
