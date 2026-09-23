// EVAL-002 (`.claude/memory/EVALS.md`) — relevé informatif du temps de frame du canvas de combat sur un
// scénario saturé (T-21/EXG-52, spec §16 T-21 « Done quand »). Ce fichier ne fait AUCUNE assertion de
// seuil en ms : `data-dernier-frame-ms` est explicitement documenté comme informatif, jamais bloquant
// (`src/canvas/CanvasCombat.tsx:195`). Un seuil de ms rendrait la porte de qualité instable (machines
// hétérogènes) — voir skill `preuve-du-rouge` : l'instrument choisi ici (comptage de frames relevées,
// finitude/positivité des valeurs) est le bon pour une mesure informative ; un timeout serré est le bon
// instrument pour un budget algorithmique (`tests/ui/canvas-limite.test.ts`), pas pour un temps de dessin
// qui varie légitimement d'une machine à l'autre.
//
// Scénario saturé : on pousse, à chaque frame réelle (vrai `requestAnimationFrame`, pas de simulation,
// comme `attendreFrames` dans `tests/ui/canvas-combat.test.tsx`), un delta de clics largement au-delà de
// `N_PROJECTILES_MAX`, pour que `demanderEffets` génère systématiquement le plafond de demandes et que
// `ajouterProjectiles` supprime les plus anciens à chaque frame — c'est le chemin le plus coûteux de
// `dessinerScene` (jusqu'à 200 `ctx.arc` par frame), en mode effets complets et en mode effets réduits
// (option performance, EXG-29 : aucun dessin de projectile, comparaison utile).

import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import { N_PROJECTILES_MAX } from '../../src/canvas/constantes.ts'
import { CanvasCombat } from '../../src/canvas/CanvasCombat.tsx'
import { CLE_REGLAGES } from '../../src/canvas/reglages.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'
import type { Stockage } from '../../src/state/ports.ts'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts'

const T0 = 1_700_000_000_000
const N_FRAMES_SATUREES = 120

function creerStoreDeTest(stockage?: Stockage): StoreJeuApi {
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: stockage ?? creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-mesure-frame',
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial,
  })
  confirmerDemarrage(planificateur)
  return store
}

async function attendreFrame(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function calculerStatistiques(valeurs: readonly number[]): { mediane: number; p95: number; max: number } {
  const triees = [...valeurs].sort((a, b) => a - b)
  const mediane = triees[Math.floor(triees.length / 2)]!
  const p95 = triees[Math.min(triees.length - 1, Math.floor(triees.length * 0.95))]!
  const max = triees[triees.length - 1]!
  return { mediane, p95, max }
}

/** Sature le tampon (`N_PROJECTILES_MAX` demandes/frame, très au-delà du plafond) pendant `n` frames
 *  réelles, en relevant `data-dernier-frame-ms` à chaque frame. */
async function releverFramesSaturees(store: StoreJeuApi, n: number): Promise<readonly number[]> {
  const { getByTestId, unmount } = render(<CanvasCombat store={store} />)
  const canvas = getByTestId('canvas-combat') as HTMLCanvasElement

  // Une première frame pose l'instantané de référence avant tout delta (comme le « témoin positif » de
  // `canvas-combat.test.tsx` : aucun delta n'est détectable avant qu'un premier instantané existe).
  await attendreFrame()

  const releves: number[] = []
  try {
    for (let i = 0; i < n; i += 1) {
      for (let c = 0; c < N_PROJECTILES_MAX; c += 1) store.getState().actions.clic()
      await attendreFrame()
      const brut = canvas.dataset.dernierFrameMs
      expect(brut).toBeDefined()
      releves.push(Number(brut))
    }
  } finally {
    unmount()
    store.arreter()
  }
  return releves
}

describe('EVAL-002 — temps de frame du canvas de combat, scénario saturé (informatif, EXG-52)', () => {
  it(
    `mode effets complets — ${N_FRAMES_SATUREES} frames saturées à ${N_PROJECTILES_MAX} projectiles`,
    async () => {
      await page.viewport(1440, 900)
      const store = creerStoreDeTest()
      const releves = await releverFramesSaturees(store, N_FRAMES_SATUREES)

      expect(releves.length).toBe(N_FRAMES_SATUREES)
      for (const v of releves) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }

      const { mediane, p95, max } = calculerStatistiques(releves)
      // eslint-disable-next-line no-console
      console.info(
        `[EVAL-002] effets complets — ${releves.length} frames saturées (${N_PROJECTILES_MAX} projectiles/frame) : ` +
          `médiane ${mediane.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, max ${max.toFixed(2)} ms`,
      )
    },
    30_000,
  )

  it(
    `mode effets réduits (option performance activée, EXG-29) — ${N_FRAMES_SATUREES} frames`,
    async () => {
      await page.viewport(1440, 900)
      const stockage = creerStockageFactice()
      stockage.ecrire(CLE_REGLAGES, '{"performance":true}')
      const store = creerStoreDeTest(stockage)
      const releves = await releverFramesSaturees(store, N_FRAMES_SATUREES)

      expect(releves.length).toBe(N_FRAMES_SATUREES)
      for (const v of releves) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
      }

      const { mediane, p95, max } = calculerStatistiques(releves)
      // eslint-disable-next-line no-console
      console.info(
        `[EVAL-002] effets réduits (option performance) — ${releves.length} frames : ` +
          `médiane ${mediane.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms, max ${max.toFixed(2)} ms`,
      )
    },
    30_000,
  )
})
