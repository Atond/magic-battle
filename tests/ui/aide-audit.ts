// Aides communes à l'audit d'accessibilité T-22 (§16 T-22, EXG-31/32/34) : fabrique de store de test et
// assertion axe-core partagées entre `audit-accessibilite.test.tsx`, `parcours-clavier-prestige.test.tsx`
// et `miroir-dom-sans-live-continu.test.tsx`, pour ne pas répéter cinq fois la même config de ports
// factices (voir `tests/ui/confirmation-prestige-ascension.test.tsx` pour le patron d'origine).

import { expect } from 'vitest'
import axe from 'axe-core'

import { etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts'
import type { Stockage } from '../../src/state/ports.ts'

export const T0 = 1_700_000_000_000

/** Même préfixe que `src/state/constantes.ts` (ADR-21) — copié ici comme dans `tests/state/persistance.test.ts`. */
export const CLE_PRINCIPALE = 'magic-battle:sauvegarde'

let compteurOnglet = 0

export function creerStoreDeTest(options: {
  readonly etatInitialFn?: (horodatageMs: number) => EtatJeu
  readonly stockage?: Stockage
} = {}): StoreJeuApi {
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: options.stockage ?? creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: `onglet-audit-${++compteurOnglet}`,
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial: options.etatInitialFn ?? etatInitial,
  })
  confirmerDemarrage(planificateur)
  return store
}

/** Parmi les doublons desktop/mobile (`Disposition` monte les deux arbres), l'élément réellement affiché. */
export function visible<T extends Element>(elements: readonly T[]): T {
  const trouve = elements.find((el) => el.getBoundingClientRect().width > 0)
  if (trouve === undefined) throw new Error('aucun élément visible parmi les correspondances')
  return trouve
}

/**
 * EXG-31/32 — `violations = 0` **et** `incomplete` de `color-contrast` = 0 (spec §12) : axe classe
 * certains contrastes douteux en `incomplete`, pas en `violations` — un `incomplete` non nul laisse
 * passer un vrai défaut, donc les deux compteurs sont vérifiés séparément, jamais fondus en un seul.
 */
export async function auditerSansViolation(cible: Element | Document = document.body): Promise<void> {
  const resultats = await axe.run(cible)
  expect(resultats.violations, JSON.stringify(resultats.violations.map((v) => v.id))).toEqual([])
  expect(resultats.incomplete.filter((r) => r.id === 'color-contrast')).toEqual([])
}
