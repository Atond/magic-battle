// Logique pure du canvas de combat (T-21, EXG-29/50/52). Sans DOM ni canvas réel : ce fichier tourne
// dans le projet `domaine` (Node), pas `ui` (Chromium) — voir `tests/ui/canvas-combat.test.tsx` pour la
// preuve sur un vrai `<canvas>`, et `tests/ui/canvas-limite.test.ts` pour le plafond N_PROJECTILES_MAX.
//
// Ce que ce fichier prouve, précisément :
//  1. `demanderEffets` — un clic de plus ⇒ un projectile ; un sort dont le cooldown vient d'augmenter ⇒
//     un projectile coloré par son école ; un monstre tué de plus ⇒ un impact ; un delta négatif (reset
//     d'Ascension, restauration d'une sauvegarde plus ancienne) ne produit JAMAIS de demande ;
//  2. `ajouterProjectiles` — plafonné à `N_PROJECTILES_MAX`, les plus anciens supprimés en premier ;
//  3. `lireOptionPerformance`/`resoudrePerformance` — quatre fixtures hostiles retombent toutes sur le
//     défaut (`prefers-reduced-motion`), et `Object.prototype` reste intact dans chaque cas.

import { describe, expect, it } from 'vitest'

import { DUREE_VIE_PROJECTILE_MS, N_PROJECTILES_MAX } from '../../src/canvas/constantes.ts'
import { demanderEffets } from '../../src/canvas/deltas.ts'
import type { InstantaneCombat, SortParEcole } from '../../src/canvas/deltas.ts'
import { CLE_REGLAGES, lireOptionPerformance, resoudrePerformance } from '../../src/canvas/reglages.ts'
import { ajouterProjectiles, purgerExpires } from '../../src/canvas/tampon.ts'
import { creerMatchMediaFactice, creerStockageFactice } from '../state/doubles.ts'

const INSTANTANE_VIDE: InstantaneCombat = { clicsCumules: 0, monstresTues: 0, cooldownsSorts: {} }
const SORTS: readonly SortParEcole[] = [
  { id: 'sort-feu', idEcole: 'feu' },
  { id: 'sort-glace', idEcole: 'glace' },
]

describe('demanderEffets — dérive les effets des écarts de compteurs, jamais d’un événement moteur', () => {
  it('un clic de plus produit un projectile de la couleur de clic', () => {
    const courant: InstantaneCombat = { ...INSTANTANE_VIDE, clicsCumules: 1 }
    const demandes = demanderEffets(INSTANTANE_VIDE, courant, [], 'couleur-clic', 'couleur-impact')
    expect(demandes).toEqual([{ couleur: 'couleur-clic', type: 'projectile' }])
  })

  it('un sort dont le cooldown vient d’augmenter produit un projectile coloré par son école', () => {
    const precedent: InstantaneCombat = { ...INSTANTANE_VIDE, cooldownsSorts: { 'sort-feu': 0, 'sort-glace': 500 } }
    const courant: InstantaneCombat = { ...INSTANTANE_VIDE, cooldownsSorts: { 'sort-feu': 3000, 'sort-glace': 500 } }
    const demandes = demanderEffets(precedent, courant, SORTS, 'couleur-clic', 'couleur-impact')
    expect(demandes).toEqual([{ couleur: 'var(--couleur-ecole-feu)', type: 'projectile' }])
  })

  it('un monstre tué de plus produit un impact', () => {
    const courant: InstantaneCombat = { ...INSTANTANE_VIDE, monstresTues: 2 }
    const demandes = demanderEffets(INSTANTANE_VIDE, courant, [], 'couleur-clic', 'couleur-impact')
    expect(demandes).toEqual([
      { couleur: 'couleur-impact', type: 'impact' },
      { couleur: 'couleur-impact', type: 'impact' },
    ])
  })

  it('un delta négatif (reset d’Ascension, sauvegarde restaurée plus ancienne) ne produit aucune demande', () => {
    const precedent: InstantaneCombat = { clicsCumules: 500, monstresTues: 40, cooldownsSorts: { 'sort-feu': 3000 } }
    const courant: InstantaneCombat = { clicsCumules: 0, monstresTues: 0, cooldownsSorts: { 'sort-feu': 0 } }
    const demandes = demanderEffets(precedent, courant, SORTS, 'couleur-clic', 'couleur-impact')
    expect(demandes).toEqual([])
  })
})

describe('ajouterProjectiles — tampon borné à N_PROJECTILES_MAX (EXG-52)', () => {
  it('sous le plafond : tout est conservé', () => {
    const demandes = [{ couleur: 'c', type: 'projectile' as const }]
    const { tampon, prochainId } = ajouterProjectiles([], demandes, 1)
    expect(tampon).toEqual([{ couleur: 'c', type: 'projectile', id: 1, expireA: 600 }])
    expect(prochainId).toBe(2)
  })

  it('au-delà du plafond : les plus anciens sont supprimés en premier', () => {
    const demandes = Array.from({ length: N_PROJECTILES_MAX + 50 }, () => ({ couleur: 'c', type: 'projectile' as const }))
    const { tampon, prochainId } = ajouterProjectiles([], demandes, 1)
    expect(tampon.length).toBe(N_PROJECTILES_MAX)
    expect(prochainId).toBe(N_PROJECTILES_MAX + 51)
    // Les 50 premiers ids (1..50) ont disparu ; les 200 derniers (51..250) restent, dans l'ordre.
    expect(tampon[0]!.id).toBe(51)
    expect(tampon[tampon.length - 1]!.id).toBe(N_PROJECTILES_MAX + 50)
  })
})

describe('demanderEffets — écart de compteur plafonné AVANT construction (EXG-52, T-23b revue)', () => {
  it('un écart de Number.MAX_SAFE_INTEGER clics ne construit jamais plus de N_PROJECTILES_MAX demandes', () => {
    const courant: InstantaneCombat = { ...INSTANTANE_VIDE, clicsCumules: Number.MAX_SAFE_INTEGER }
    const demandes = demanderEffets(INSTANTANE_VIDE, courant, [], 'couleur-clic', 'couleur-impact')
    expect(demandes.length).toBe(N_PROJECTILES_MAX)
    expect(demandes.every((d) => d.couleur === 'couleur-clic' && d.type === 'projectile')).toBe(true)
  },
  1000)

  it('un écart de Number.MAX_SAFE_INTEGER monstres tués est plafonné de la même façon', () => {
    const courant: InstantaneCombat = { ...INSTANTANE_VIDE, monstresTues: Number.MAX_SAFE_INTEGER }
    const demandes = demanderEffets(INSTANTANE_VIDE, courant, [], 'couleur-clic', 'couleur-impact')
    expect(demandes.length).toBe(N_PROJECTILES_MAX)
  },
  1000)
})

describe('purgerExpires — un projectile disparaît après sa durée de vie (EXG-52 revue)', () => {
  it('un projectile créé à t=0 est encore là juste avant expiration, disparu juste après', () => {
    const { tampon } = ajouterProjectiles([], [{ couleur: 'c', type: 'projectile' }], 1, 0)
    expect(purgerExpires(tampon, DUREE_VIE_PROJECTILE_MS - 1)).toEqual(tampon)
    expect(purgerExpires(tampon, DUREE_VIE_PROJECTILE_MS + 1)).toEqual([])
  })

  it('ajouterProjectiles purge lui-même les expirés avant de combiner (un tampon peu renouvelé se vide)', () => {
    const { tampon: t1 } = ajouterProjectiles([], [{ couleur: 'c', type: 'projectile' }], 1, 0)
    // Bien après expiration, sans nouvelle demande : le tampon combiné doit repartir de rien plutôt que
    // de garder le vieux projectile pour de bon.
    const { tampon: t2 } = ajouterProjectiles(t1, [], 2, DUREE_VIE_PROJECTILE_MS + 1000)
    expect(t2).toEqual([])
  })
})

describe('réglage performance — lecture try/catch, fixtures hostiles (EXG-29/50, ADR-21)', () => {
  const fixturesHostiles: readonly [string, string][] = [
    ['clé polluante __proto__ plutôt qu’un champ performance', '{"__proto__":{"performance":true}}'],
    ['chaîne JSON au lieu d’un objet', '"true"'],
    ['nombre JSON au lieu d’un objet', '1'],
    ['JSON invalide', '{invalide'],
    ['clé étrangère à côté d’un champ performance mal typé', '{"inconnue":1,"performance":"true"}'],
    ['tableau JSON au lieu d’un objet', '[true]'],
  ]

  for (const [libelle, brut] of fixturesHostiles) {
    it(`${libelle} → défaut (null), Object.prototype intact`, () => {
      const stockage = creerStockageFactice()
      stockage.ecrire(CLE_REGLAGES, brut)
      expect(lireOptionPerformance(stockage)).toBeNull()
      // La preuve qui compte vraiment : aucune fixture ci-dessus n'a laissé de trace sur le prototype
      // global, même celle qui pose littéralement une clé nommée « __proto__ ».
      expect((Object.prototype as Record<string, unknown>).performance).toBeUndefined()
    })
  }

  it('champ absent, objet par ailleurs valide → défaut (null)', () => {
    const stockage = creerStockageFactice()
    stockage.ecrire(CLE_REGLAGES, '{"autreChose":true}')
    expect(lireOptionPerformance(stockage)).toBeNull()
  })

  it('valeur explicite valide → relue telle quelle', () => {
    const stockage = creerStockageFactice()
    stockage.ecrire(CLE_REGLAGES, '{"performance":true}')
    expect(lireOptionPerformance(stockage)).toBe(true)
  })

  it('resoudrePerformance retombe sur prefers-reduced-motion en l’absence de choix explicite', () => {
    const stockage = creerStockageFactice()
    expect(resoudrePerformance(stockage, creerMatchMediaFactice(true))).toBe(true)
    expect(resoudrePerformance(stockage, creerMatchMediaFactice(false))).toBe(false)
  })

  it('resoudrePerformance priorise le choix explicite persisté sur prefers-reduced-motion', () => {
    const stockage = creerStockageFactice()
    stockage.ecrire(CLE_REGLAGES, '{"performance":false}')
    expect(resoudrePerformance(stockage, creerMatchMediaFactice(true))).toBe(false)
  })
})
