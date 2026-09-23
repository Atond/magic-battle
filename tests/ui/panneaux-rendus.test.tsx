// Test de comptage de renders (T-18, ADR-19, spec §16 T-18 « Done quand »). Vrai navigateur (Vitest
// browser mode + Playwright, ADR-20) : `<Profiler>` de React ne renvoie des commits significatifs que
// dans un DOM réel.
//
// Ce que ce test prouve, précisément :
//  1. « témoin positif » — un panneau qui sélectionne l'or (`s.etat.bourse.or`) re-rend bien après un
//     lot de ticks qui a fait bouger l'or : la mécanique de sélection n'est pas cassée/toujours muette.
//  2. « aucun re-render à chaque tick » — un seul lot de 10 ticks (une frame de 1000 ms) ne produit
//     qu'un seul commit du panneau, pas dix : le tick à 100 ms tourne hors React (ADR-19), React ne voit
//     qu'une notification par frame traitée.
//  3. « panneau indépendant » — un second panneau qui sélectionne un champ que ce lot de ticks ne touche
//     pas (`clicsCumules`) reste à son commit initial, 0 commit supplémentaire, pendant la même fenêtre.

import { Profiler, StrictMode } from 'react'
import type { ProfilerOnRenderCallback } from 'react'
import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'

import { etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'
import { useStoreJeu } from '../../src/state/hooks.ts'
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

/** École du feu déjà montée : sans DPS, l'or ne bougerait jamais et le témoin positif ne prouverait rien. */
function etatInitialProductif(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return { ...base, ecoles: { ...base.ecoles, feu: { niveau: 10, debloquee: true, revelee: true } } }
}

function PanneauOr({ store }: { readonly store: StoreJeuApi }) {
  const or = useStoreJeu(store, (etat) => etat.etat.bourse.or)
  return <span data-testid="or">{or}</span>
}

function PanneauIndependant({ store }: { readonly store: StoreJeuApi }) {
  const clics = useStoreJeu(store, (etat) => etat.etat.magicien.clicsCumules)
  return <span data-testid="clics">{clics}</span>
}

describe('sélecteurs Zustand fins — pas de re-render global au tick (spec T-18)', () => {
  it('un lot de 10 ticks (une frame) : le panneau or commit une fois, le panneau indépendant zéro fois', async () => {
    const horloge = creerHorlogeFactice(T0)
    const stockage = creerStockageFactice()
    const canal = creerCanalFactice()
    const matchMedia = creerMatchMediaFactice()
    const portPage = creerPortPageFactice()
    const portPlanificateur = creerPortPlanificateurFactice()

    const store = creerStoreJeu({
      horloge,
      stockage,
      canal,
      matchMedia,
      idOnglet: 'onglet-panneaux',
      portPage,
      portPlanificateur,
      etatInitial: etatInitialProductif,
    })
    confirmerDemarrage(portPlanificateur)

    let commitsOr = 0
    let commitsIndependant = 0
    const compterOr: ProfilerOnRenderCallback = () => {
      commitsOr += 1
    }
    const compterIndependant: ProfilerOnRenderCallback = () => {
      commitsIndependant += 1
    }

    const { getByTestId } = render(
      <StrictMode>
        <Profiler id="or" onRender={compterOr}>
          <PanneauOr store={store} />
        </Profiler>
        <Profiler id="independant" onRender={compterIndependant}>
          <PanneauIndependant store={store} />
        </Profiler>
      </StrictMode>,
    )

    // Montage initial : un commit chacun (StrictMode double-invoque les rendus en dev, jamais les
    // commits DOM effectifs — on ne fige donc pas ce nombre, seulement l'écart provoqué par les ticks).
    const orAuMontage = getByTestId('or').textContent
    const commitsOrApresMontage = commitsOr
    const commitsIndependantApresMontage = commitsIndependant

    // Sous 100 ms : aucun tick, donc aucune notification, donc aucun commit supplémentaire nulle part.
    act(() => {
      horloge.avancer(50)
      portPlanificateur.declencherFrame()
    })
    expect(commitsOr).toBe(commitsOrApresMontage)
    expect(commitsIndependant).toBe(commitsIndependantApresMontage)

    // 1000 ms d'un coup = 10 ticks traités en une seule frame ⇒ une seule notification (EXG-2), donc au
    // plus un commit supplémentaire — jamais dix. Témoin positif : l'or affiché a bien changé.
    act(() => {
      horloge.avancer(1_000)
      portPlanificateur.declencherFrame()
    })

    expect(getByTestId('or').textContent).not.toBe(orAuMontage)
    expect(commitsOr).toBe(commitsOrApresMontage + 1)
    // Le panneau indépendant (clics) ne sélectionne rien que ce lot de ticks ait changé : 0 commit de plus.
    expect(commitsIndependant).toBe(commitsIndependantApresMontage)

    store.arreter()
  })
})
