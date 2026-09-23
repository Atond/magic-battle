// Miroir DOM du combat sans `aria-live` continu (T-22, spec §16 T-22, EXG-32). `MiroirCombat`
// (`src/canvas/CanvasCombat.tsx`) n'écrit dans sa région `aria-live="polite"` (`annonce-combat`) que sur
// un événement significatif (monstre vaincu, arrivée d'un boss) — jamais à la cadence du tick 100 ms
// (`PAS_TICK_MS`, `src/domain/constantes-moteur.ts`), qui spammerait un lecteur d'écran.
//
// Construction : une cible à PV énormes (`Number.MAX_SAFE_INTEGER`), pour qu'aucun coup porté pendant la
// fenêtre du test ne puisse jamais la tuer, aucun hasard requis — le tick avance via de vrais appels au
// moteur (`horloge.avancer` + `planificateur.declencherFrame`, ports factices déterministes de
// `tests/state/doubles.ts`), jamais un état forgé après coup pour « annonce ».
//
// Vrai navigateur (Vitest browser mode + Playwright, ADR-20) : un `MutationObserver` réel sur le nœud
// DOM prouve l'absence de mutation, ce que lire `textContent` avant/après ne prouverait pas aussi bien
// (une mutation « texte identique remplacé » ne changerait pas la valeur lue mais compterait comme un
// battement `aria-live` pour un lecteur d'écran).

import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import { PAS_TICK_MS } from '../../src/domain/constantes-moteur.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import {
  confirmerDemarrage,
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import { visible } from './aide-audit.ts'

const T0 = 1_700_000_000_000

/** Cible increvable pendant la fenêtre du test : aucun coup ne peut la faire passer sous 0 PV. */
function etatCibleIndestructible(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return {
    ...base,
    combat: {
      ...base.combat,
      cible: { nom: 'Cible de test', pvMax: Number.MAX_SAFE_INTEGER, pvCourants: Number.MAX_SAFE_INTEGER, orAuMeurtre: 0 },
    },
  }
}

describe('T-22 — miroir DOM du combat sans aria-live continu (EXG-32)', () => {
  it('20 ticks de 100 ms ne mutent jamais la région aria-live, alors que le combat progresse', async () => {
    await page.viewport(1440, 900)
    const horloge = creerHorlogeFactice(T0)
    const planificateur = creerPortPlanificateurFactice()
    const store = creerStoreJeu({
      horloge,
      stockage: creerStockageFactice(),
      canal: creerCanalFactice(),
      matchMedia: creerMatchMediaFactice(),
      idOnglet: 'onglet-miroir-dom',
      portPage: creerPortPageFactice(),
      portPlanificateur: planificateur,
      etatInitial: etatCibleIndestructible,
    })
    confirmerDemarrage(planificateur)

    const { getAllByTestId, unmount } = render(<Disposition store={store} />)
    const region = visible(getAllByTestId('annonce-combat'))
    expect(region.getAttribute('aria-live')).toBe('polite')

    let mutations = 0
    const observateur = new MutationObserver((liste) => {
      mutations += liste.length
    })
    observateur.observe(region, { characterData: true, childList: true, subtree: true })

    // 20 ticks réels du moteur (2 s à 100 ms/tick) : aucun ne peut tuer la cible increvable, donc aucun
    // n'a de raison de toucher la région aria-live.
    for (let i = 0; i < 20; i++) {
      horloge.avancer(PAS_TICK_MS)
      planificateur.declencherFrame()
    }
    // Laisse le navigateur traiter les mutations en attente avant de les compter (MutationObserver est
    // asynchrone par microtask, jamais synchrone avec la mutation elle-même).
    await new Promise((r) => queueMicrotask(() => r(undefined)))

    expect(mutations).toBe(0)
    expect(region.textContent).toBe('')

    // Preuve que le moteur a bien avancé pendant ces 20 ticks (sinon le test « prouverait » l'absence de
    // mutation d'une région qui ne bouge jamais de toute façon, ce qui ne prouverait rien) : le temps de
    // jeu simulé a progressé d'exactement 20 × `PAS_TICK_MS` (aucune école achetée au départ, donc pas de
    // dégâts passifs à attendre pour cette preuve).
    expect(store.getState().etat.tempsJeuMs).toBe(20 * PAS_TICK_MS)

    observateur.disconnect()
    unmount()
    store.arreter()
  })
})
