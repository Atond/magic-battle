// EXG-30/EXG-52 — structures de rendu bornées, coût constant par frame (T-21, spec §16 T-21 « Done
// quand »). Deux garde-fous de nature différente :
//  1. un critère déterministe (pas de timing) : une seule frame avec plus de 200 écarts de compteur
//     produit plus de 200 DEMANDES, mais jamais plus de 200 dessins effectifs, les plus anciens
//     supprimés en premier — voir aussi `tests/ui/canvas-deltas.test.ts` pour la même preuve unitaire ;
//  2. un timeout serré sur un volume simulant grossièrement 2 h de combat à haute cadence
//     (`tests/domain/zones.test.ts`, `tests/domain/tick.test.ts` : même patron, LRN-002) : SI
//     `ajouterProjectiles` gardait un jour l'historique complet au lieu de le plafonner, la boucle
//     passerait de O(n) à O(n²) et ce test n'atteindrait jamais son `expect` avant le timeout. Le
//     timeout EST l'assertion — ne pas l'assouplir en le prenant pour une fragilité de CI (skill
//     `preuve-du-rouge`).

import { describe, expect, it } from 'vitest'

import { N_PROJECTILES_MAX } from '../../src/canvas/constantes.ts'
import type { DemandeEffet } from '../../src/canvas/deltas.ts'
import { ajouterProjectiles } from '../../src/canvas/tampon.ts'
import type { Projectile } from '../../src/canvas/tampon.ts'

describe('EXG-52 — plafond déterministe sur une frame unique', () => {
  it('plus de 200 écarts de compteur sur une frame : dessins effectifs ≤ 200, les plus anciens supprimés', () => {
    const demandes: DemandeEffet[] = Array.from({ length: 260 }, () => ({ couleur: 'c', type: 'projectile' }))
    expect(demandes.length).toBeGreaterThan(N_PROJECTILES_MAX)

    const { tampon } = ajouterProjectiles([], demandes, 1)
    expect(tampon.length).toBeLessThanOrEqual(N_PROJECTILES_MAX)
    expect(tampon.length).toBe(N_PROJECTILES_MAX)
    expect(tampon[0]!.id).toBe(61) // les ids 1..60 (les plus anciens) ont été supprimés en premier.
  })
})

describe('EXG-30/52 — coût constant par frame sur un très grand nombre de frames (timeout serré = assertion)', () => {
  it(
    '200 000 frames, 5 demandes chacune (≈ 1 000 000 d’effets) : le tampon reste borné, sous 3 s',
    () => {
      const N_FRAMES = 200_000
      const DEMANDES_PAR_FRAME = 5
      let tampon: readonly Projectile[] = []
      let prochainId = 1

      for (let i = 0; i < N_FRAMES; i += 1) {
        const demandes: DemandeEffet[] = Array.from({ length: DEMANDES_PAR_FRAME }, () => ({
          couleur: 'c',
          type: 'projectile',
        }))
        const resultat = ajouterProjectiles(tampon, demandes, prochainId)
        tampon = resultat.tampon
        prochainId = resultat.prochainId
      }

      expect(tampon.length).toBe(N_PROJECTILES_MAX)
      expect(prochainId).toBe(N_FRAMES * DEMANDES_PAR_FRAME + 1)
      // Aucune structure parcourue par frame n'a grandi sans borne (EXG-30) : le dernier id du tampon
      // est bien le tout dernier généré, la fenêtre glissante n'a jamais perdu le fil.
      expect(tampon[tampon.length - 1]!.id).toBe(N_FRAMES * DEMANDES_PAR_FRAME)
    },
    3000,
  )
})
