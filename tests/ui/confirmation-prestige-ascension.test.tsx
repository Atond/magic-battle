// Confirmations à deux étapes — prestige et Ascension (T-23b, EXG-19/20/21/44). Vrai navigateur
// (Vitest browser mode + Playwright, ADR-20) : `userEvent` pour de vrais clics/touches, à 1440 px
// (colonnes desktop) — `Disposition` monte desktop **et** mobile en parallèle (l'un masqué en CSS,
// `hud-disposition.test.tsx`), d'où les `getAllByTestId(...).find(largeur > 0)` pour cibler le bouton
// réellement visible plutôt que son double caché.
//
// Ce que ce fichier prouve, précisément :
//  1. un prestige déclenché sous la zone 4 (formule → 0 Éclat) affiche « 0 Éclat », pas un écran vide ;
//  2. annuler à la 1re étape ne modifie aucun état (référence `etat` inchangée) ;
//  3. une Ascension à gain 0 Point affiche « 0 Point », se confirme, remet le cycle d'Éclats à zéro ;
//  4. le focus initial de chaque étape est sur « Annuler » ;
//  5. Échap annule la modale sans rien modifier ;
//  6. les touches 1-6 restent sans effet pendant qu'une modale de confirmation est ouverte
//     (`[aria-modal="true"]`, mécanisme posé en T-20) ;
//  7. les boutons de confirmation sont désactivés une fois `partieTerminee` (EXG-44).

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
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
import type { StoreJeuApi } from '../../src/state/store.ts'

const T0 = 1_700_000_000_000

function creerStoreDeTest(etatInitialFn: (horodatageMs: number) => EtatJeu = etatInitial): StoreJeuApi {
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-confirmations',
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial: etatInitialFn,
  })
  confirmerDemarrage(planificateur)
  return store
}

/** Zone 3 : `floor(k × zone^alpha)` avec `k=0.3, alpha=1` (constantes actuelles) rend 0 Éclat. */
function etatSousZone4(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return {
    ...base,
    combat: { ...base.combat, zone: 3 },
    prestige: { ...base.prestige, zoneMaxDuRun: 3 },
  }
}

/** Cycle au seuil (6 prestiges), mais aucun Éclat cumulé à vie : `floor(√0) = 0` Point. */
function etatAscensionGainNul(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return {
    ...base,
    prestige: { ...base.prestige, prestigesDuCycle: 6, eclatsCumulesAVie: 0 },
  }
}

function etatPartieTerminee(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return { ...base, partieTerminee: true }
}

function visible<T extends Element>(elements: readonly T[]): T {
  const trouve = elements.find((el) => el.getBoundingClientRect().width > 0)
  if (trouve === undefined) throw new Error('aucun élément visible parmi les correspondances')
  return trouve
}

describe('confirmation à deux étapes — prestige (EXG-19/21)', () => {
  it('sous la zone 4, la 2e étape affiche « 0 Éclat », pas un écran vide', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest(etatSousZone4)
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-prestige')))

    const dialogue = getByRole('dialog', { name: 'Recommencer le run ?' })
    expect(dialogue).toBeTruthy()

    // Focus initial sur « Annuler » (spec T-23b).
    const annuler1 = [...dialogue.querySelectorAll('button')].find((b) => b.textContent === 'Annuler')!
    expect(document.activeElement).toBe(annuler1)

    const continuer = [...dialogue.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!
    await userEvent.click(continuer)

    const etape2 = getByRole('dialog', { name: 'Confirme le prestige' })
    const gain = visible(getAllByTestId('prestige-gain'))
    expect(gain.textContent).toContain('0 Éclat')

    const annuler2 = [...etape2.querySelectorAll('button')].find((b) => b.textContent === 'Annuler')!
    expect(document.activeElement).toBe(annuler2)

    unmount()
    store.arreter()
  })

  it('annuler à la 1re étape ne modifie aucun état', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const etatAvant = store.getState().etat
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-prestige')))

    const dialogue = getByRole('dialog', { name: 'Recommencer le run ?' })
    const annuler = [...dialogue.querySelectorAll('button')].find((b) => b.textContent === 'Annuler')!
    await userEvent.click(annuler)

    expect(store.getState().etat).toBe(etatAvant)

    unmount()
    store.arreter()
  })

  it('Échap annule la modale sans rien modifier', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const etatAvant = store.getState().etat
    const { getByRole, queryByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-prestige')))

    getByRole('dialog', { name: 'Recommencer le run ?' })
    await userEvent.keyboard('{Escape}')

    // La modale se ferme réellement (pas seulement « rien ne s'est passé »).
    expect(queryByRole('dialog')).toBeNull()
    expect(store.getState().etat).toBe(etatAvant)

    unmount()
    store.arreter()
  })

  it('les touches 1-6 sont sans effet pendant que la modale de prestige est ouverte', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-prestige')))

    expect(document.querySelector('[aria-modal="true"]')).not.toBeNull()
    const etatAvant = store.getState().etat
    await userEvent.keyboard('1')
    // La touche 1 correspond au sort de Feu (`useRaccourcisSorts`, `BarreSorts.tsx`) : si elle passait
    // encore pendant la modale, `lancerSort` changerait au moins le cooldown de ce sort.
    expect(store.getState().etat).toBe(etatAvant)

    unmount()
    store.arreter()
  })

  it('un prestige confirmé crédite exactement le gain affiché et réinitialise le run', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-prestige')))
    const etape1 = getByRole('dialog', { name: 'Recommencer le run ?' })
    await userEvent.click([...etape1.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!)
    const etape2 = getByRole('dialog', { name: 'Confirme le prestige' })
    expect(visible(getAllByTestId('prestige-gain')).textContent).toContain('0 Éclat')
    await userEvent.click([...etape2.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirmer'))!)

    expect(store.getState().etat.combat.zone).toBe(1)
    expect(store.getState().etat.prestige.prestigesTotal).toBe(1)

    unmount()
    store.arreter()
  })

  it('le gain figé à l’ouverture ne se recalcule pas pendant que la modale est ouverte, et c’est lui qui est crédité (spec T-23b)', async () => {
    await page.viewport(1440, 900)
    // Zone 10, k=0.3/alpha=1 (constantes actuelles) : floor(0.3 × 10) = 3 Éclats — non nul (zone ≥ 4).
    const store = creerStoreDeTest((horodatageMs) => {
      const base = etatInitial(horodatageMs)
      return { ...base, combat: { ...base.combat, zone: 10 }, prestige: { ...base.prestige, zoneMaxDuRun: 10 } }
    })
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-prestige')))
    const etape1 = getByRole('dialog', { name: 'Recommencer le run ?' })
    await userEvent.click([...etape1.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!)

    const etape2 = getByRole('dialog', { name: 'Confirme le prestige' })
    expect(visible(getAllByTestId('prestige-gain')).textContent).toContain('3 Éclats')

    // Pendant que la modale reste ouverte, l'état change sous elle (l'équivalent d'un tick de jeu qui
    // ferait progresser `zoneMaxDuRun`, donc le gain recalculé EN DIRECT — floor(0.3 × 100) = 30) :
    store.setState((s) => ({
      etat: { ...s.etat, combat: { ...s.etat.combat, zone: 100 }, prestige: { ...s.etat.prestige, zoneMaxDuRun: 100 } },
    }))

    // Laisse React flusher un éventuel re-render déclenché par ce changement d'état, plutôt que de lire
    // le DOM avant que la mise à jour n'ait eu la moindre chance de s'appliquer (ce qui masquerait un
    // recalcul en direct au lieu de prouver l'absence de recalcul).
    await new Promise<void>((resolve) => setTimeout(resolve, 50))

    // Le texte affiché ne doit PAS avoir bougé : c'est le gain figé à l'ouverture, pas la valeur en direct.
    expect(visible(getAllByTestId('prestige-gain')).textContent).toContain('3 Éclats')
    expect(visible(getAllByTestId('prestige-gain')).textContent).not.toContain('30 Éclats')

    await userEvent.click([...etape2.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirmer'))!)

    // Crédité : exactement le gain figé affiché (3), jamais le gain recalculé au clic (qui aurait été 30
    // si le domaine avait retrouvé `zoneMaxDuRun: 100` au moment de `prestiger()`).
    expect(store.getState().etat.bourse.eclatsPossedes).toBe(3)
    expect(store.getState().etat.prestige.eclatsCumulesAVie).toBe(3)

    unmount()
    store.arreter()
  })
})

describe('confirmation à deux étapes — Ascension (EXG-20/21)', () => {
  it('à gain 0 Point, la 2e étape affiche « 0 Point » et se confirme', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest(etatAscensionGainNul)
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-ascension')))

    const etape1 = getByRole('dialog', { name: 'Ascensionner ?' })
    await userEvent.click([...etape1.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!)

    const etape2 = getByRole('dialog', { name: 'Confirme l’Ascension' })
    expect(visible(getAllByTestId('ascension-gain')).textContent).toContain('0 Point')

    const annuler2 = [...etape2.querySelectorAll('button')].find((b) => b.textContent === 'Annuler')!
    expect(document.activeElement).toBe(annuler2)

    await userEvent.click([...etape2.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirmer'))!)

    expect(store.getState().etat.ascension.ascensionsEffectuees).toBe(1)
    expect(store.getState().etat.bourse.eclatsPossedes).toBe(0)
    expect(store.getState().etat.prestige.rangsArbreEclats).toEqual({})

    unmount()
    store.arreter()
  })

  it('le gain de Points d’Ascension figé à l’ouverture n’est pas recalculé pendant que la modale est ouverte, et c’est lui qui est crédité (spec T-23b)', async () => {
    await page.viewport(1440, 900)
    // kAscension=1 (constantes actuelles) : floor(1 × √16) = 4 Points — non nul.
    const store = creerStoreDeTest((horodatageMs) => {
      const base = etatInitial(horodatageMs)
      return { ...base, prestige: { ...base.prestige, prestigesDuCycle: 6, eclatsCumulesAVie: 16 } }
    })
    const { getByRole, getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.click(visible(getAllByTestId('bouton-declencher-ascension')))
    const etape1 = getByRole('dialog', { name: 'Ascensionner ?' })
    await userEvent.click([...etape1.querySelectorAll('button')].find((b) => b.textContent === 'Continuer')!)

    const etape2 = getByRole('dialog', { name: 'Confirme l’Ascension' })
    expect(visible(getAllByTestId('ascension-gain')).textContent).toContain('4 Points')

    // floor(1 × √10000) = 100 Points si le gain était recalculé en direct à ce moment.
    store.setState((s) => ({
      etat: { ...s.etat, prestige: { ...s.etat.prestige, eclatsCumulesAVie: 10_000 } },
    }))
    await new Promise<void>((resolve) => setTimeout(resolve, 50))

    expect(visible(getAllByTestId('ascension-gain')).textContent).toContain('4 Points')
    expect(visible(getAllByTestId('ascension-gain')).textContent).not.toContain('100 Points')

    await userEvent.click([...etape2.querySelectorAll('button')].find((b) => b.textContent?.includes('Confirmer'))!)

    expect(store.getState().etat.bourse.pointsAscension).toBe(4)

    unmount()
    store.arreter()
  })
})

describe('EXG-44 — boutons de confirmation désactivés une fois la partie terminée', () => {
  it('prestige et Ascension sont désactivés sur une partie terminée', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest(etatPartieTerminee)
    const { getAllByTestId, unmount } = render(<Disposition store={store} />)

    expect(visible(getAllByTestId('bouton-declencher-prestige'))).toBeDisabled()
    expect(visible(getAllByTestId('bouton-declencher-ascension'))).toBeDisabled()

    unmount()
    store.arreter()
  })
})
