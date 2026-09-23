// Accès à la zone du boss final (EXG-28, vague 3) — vrai navigateur, vrai `Disposition`, vrais clics.
//
// Ce que ce fichier prouve :
//  1. sous le seuil d'Ascensions (lu dans `CONSTANTES.fin`), aucun encart ni bouton — aux deux largeurs ;
//  2. au seuil, l'encart montre la zone et le boss (textes de `TEXTES_FIN`) et le chrono lu dans
//     `apercuFin` ; un clic arme réellement le combat final dans l'état ;
//  3. pendant ce combat, l'en-tête nomme la zone finale, le miroir DOM du canvas nomme le boss final,
//     affiche ses PV et son chrono (lus dans `EtatJeu.bossFinal`, pas dans `combat`) et l'encart disparaît ;
//  4. lecture seule : bouton désactivé ; partie terminée : encart absent.
//
// Les Ascensions sont faites par le moteur (`ascensionner`), jamais posées à la main.
//
//  5. de bout en bout, par la vraie boucle du store (frames et horloge factices) : le chrono affiché
//     décompte au tick ; chrono écoulé → combat refermé, encart revenu, rien d'autre ne bouge ; un vrai
//     clic « Frapper » qui achève le boss → écran de fin.

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { act, render } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'

import '../../src/index.css'

import { apercuFin } from '../../src/domain/fin/index.ts'
import { formater } from '../../src/domain/notation.ts'
import { creerBoss, timerBossMs } from '../../src/domain/zones/index.ts'
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
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { TEXTES_FIN } from '../../src/donnees/fin.ts'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { T0, apresAscensions, creerStoreDeTest, visible } from './aide-audit.ts'

const SEUIL = CONSTANTES.fin.nAscensionsRequises

describe('EXG-28 — encart de zone finale, seuil', () => {
  it.each([1440, 375] as const)('%i px : absent une Ascension avant le seuil, présent au seuil', async (largeur) => {
    await page.viewport(largeur, largeur === 1440 ? 900 : 800)

    const avant = creerStoreDeTest({ etatInitialFn: apresAscensions(SEUIL - 1) })
    const rendu1 = render(<Disposition store={avant} />)
    try {
      expect(rendu1.queryAllByRole('region', { name: TEXTES_UI.zoneFinale.titre }), 'encart sous le seuil').toHaveLength(0)
      expect(rendu1.queryAllByRole('button', { name: TEXTES_UI.zoneFinale.entrer })).toHaveLength(0)
    } finally {
      rendu1.unmount()
      avant.arreter()
    }

    const au = creerStoreDeTest({ etatInitialFn: apresAscensions(SEUIL) })
    const rendu2 = render(<Disposition store={au} />)
    try {
      // `getByRole` ignore l'arbre masqué en CSS : exactement un encart, celui de la disposition visible.
      const encart = rendu2.getByRole('region', { name: TEXTES_UI.zoneFinale.titre })
      for (const texte of [
        TEXTES_FIN.zoneFinale.nom,
        TEXTES_FIN.zoneFinale.description,
        TEXTES_FIN.bossFinal.nom,
        TEXTES_FIN.bossFinal.description,
        TEXTES_UI.zoneFinale.chrono(Math.ceil(apercuFin(au.getState().etat, CONSTANTES).timerMs / 1000)),
      ]) {
        expect(encart.textContent).toContain(texte)
      }
      rendu2.getByRole('button', { name: TEXTES_UI.zoneFinale.entrer })
    } finally {
      rendu2.unmount()
      au.arreter()
    }
  })
})

describe('EXG-28 — entrée dans la zone finale', () => {
  it.each([1440, 375] as const)('%i px : le clic arme le combat final, le HUD montre le boss et son chrono', async (largeur) => {
    await page.viewport(largeur, largeur === 1440 ? 900 : 800)
    const store = creerStoreDeTest({ etatInitialFn: apresAscensions(SEUIL) })
    const { getAllByTestId, getByRole, queryAllByRole, unmount } = render(<Disposition store={store} />)
    try {
      expect(store.getState().etat.bossFinal).toBeUndefined()
      await userEvent.click(getByRole('button', { name: TEXTES_UI.zoneFinale.entrer }))

      const apercu = apercuFin(store.getState().etat, CONSTANTES)
      expect(store.getState().etat.bossFinal).toEqual({ pvCourants: apercu.pvBossFinal, timerRestantMs: apercu.timerMs })
      expect(queryAllByRole('region', { name: TEXTES_UI.zoneFinale.titre }), 'encart pendant le combat final').toHaveLength(0)

      expect(visible(getAllByTestId('nom-region')).textContent).toBe(TEXTES_FIN.zoneFinale.nom)
      expect(visible(getAllByTestId('nom-cible')).textContent).toBe(TEXTES_FIN.bossFinal.nom)
      expect(visible(getAllByTestId('pv-cible')).textContent).toBe(
        TEXTES_UI.combat.pv(formater(Math.ceil(apercu.pvBossFinal)), formater(apercu.pvBossFinal)),
      )
      expect(visible(getAllByTestId('timer-boss')).textContent).toBe(
        TEXTES_UI.combat.timerBoss(Math.ceil(apercu.timerMs / 1000)),
      )
      expect(visible(getAllByTestId('annonce-combat')).textContent).toBe(
        TEXTES_UI.combat.bossEnApproche(TEXTES_FIN.bossFinal.nom),
      )

      // Le chrono affiché suit `bossFinal.timerRestantMs`, pas le chrono des boss de zone.
      const reste = { pvCourants: 1, timerRestantMs: 12_300 }
      act(() => store.setState({ etat: { ...store.getState().etat, bossFinal: reste } }))
      expect(visible(getAllByTestId('timer-boss')).textContent).toBe(TEXTES_UI.combat.timerBoss(13))
      expect(visible(getAllByTestId('pv-cible')).textContent).toBe(
        TEXTES_UI.combat.pv(formater(1), formater(apercu.pvBossFinal)),
      )
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('entrée pendant un boss de zone : l’annonce nomme quand même le boss final', async () => {
    // Un boss de zone déjà à l'écran : `boss` ne passe pas de faux à vrai à l'entrée, seul le front
    // montant du combat final peut déclencher l'annonce.
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({
      etatInitialFn: apresAscensions(SEUIL, (etat) => ({
        combat: {
          ...etat.combat,
          phase: 'boss',
          cible: creerBoss(etat.combat.zone, CONSTANTES),
          timerBossRestantMs: timerBossMs(CONSTANTES),
        },
      })),
    })
    const { getAllByTestId, getByRole, unmount } = render(<Disposition store={store} />)
    try {
      await userEvent.click(getByRole('button', { name: TEXTES_UI.zoneFinale.entrer }))
      expect(visible(getAllByTestId('annonce-combat')).textContent, 'annonce à l’entrée du combat final').toBe(
        TEXTES_UI.combat.bossEnApproche(TEXTES_FIN.bossFinal.nom),
      )
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('lecture seule : bouton désactivé, un clic n’arme rien', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({ etatInitialFn: apresAscensions(SEUIL) })
    const { getByRole, unmount } = render(<Disposition store={store} />)
    try {
      act(() => store.setState({ lectureSeule: true, motifLectureSeule: 'ongletSecondaire' }))
      const bouton = getByRole('button', { name: TEXTES_UI.zoneFinale.entrer }) as HTMLButtonElement
      expect(bouton.disabled, 'bouton d’entrée en lecture seule').toBe(true)
      await userEvent.click(bouton, { force: true })
      expect(store.getState().etat.bossFinal).toBeUndefined()
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('partie terminée : plus d’encart, même au-delà du seuil', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest({ etatInitialFn: apresAscensions(SEUIL, () => ({ partieTerminee: true })) })
    const { getByRole, queryAllByRole, unmount } = render(<Disposition store={store} />)
    try {
      // Précondition : c'est bien le HUD qui est rendu (pas l'écran de fin, qui masquerait tout).
      getByRole('region', { name: TEXTES_UI.combat.titre })
      expect(queryAllByRole('region', { name: TEXTES_UI.zoneFinale.titre }), 'encart après la fin').toHaveLength(0)
    } finally {
      unmount()
      store.arreter()
    }
  })
})

/** Store dont le test pilote l'horloge et les frames : la vraie boucle `appliquerDelta` fait avancer le combat. */
function creerStorePilote() {
  const horloge = creerHorlogeFactice(T0)
  const planificateur = creerPortPlanificateurFactice()
  const store = creerStoreJeu({
    horloge,
    stockage: creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-zone-finale',
    portPage: creerPortPageFactice(),
    portPlanificateur: planificateur,
    etatInitial: (horodatageMs) => apresAscensions(SEUIL)(horodatageMs),
  })
  confirmerDemarrage(planificateur)
  /** Une frame après `ms` de temps réel, dans `act()` (piège 4). */
  const frame = (ms: number) =>
    act(() => {
      horloge.avancer(ms)
      planificateur.declencherFrame()
    })
  return { store, frame }
}

async function entrer(store: StoreJeuApi, rendu: RenderResult): Promise<void> {
  await userEvent.click(rendu.getByRole('button', { name: TEXTES_UI.zoneFinale.entrer }))
  expect(store.getState().etat.bossFinal, 'combat final armé par le clic').toBeDefined()
}

describe('EXG-28 / EXG-44 — combat final par la vraie boucle', () => {
  it('le chrono décompte au tick ; écoulé, le combat se referme et rien d’autre ne bouge', async () => {
    await page.viewport(1440, 900)
    const { store, frame } = creerStorePilote()
    const rendu = render(<Disposition store={store} />)
    try {
      await entrer(store, rendu)
      const apercu = apercuFin(store.getState().etat, CONSTANTES)
      const secondes = Math.ceil(apercu.timerMs / 1000)

      frame(1000)
      expect(visible(rendu.getAllByTestId('timer-boss')).textContent).toBe(TEXTES_UI.combat.timerBoss(secondes - 1))

      const avant = store.getState().etat
      // Des pas d'une seconde, sous le seuil de rattrapage : c'est la boucle ordinaire qui joue le chrono.
      for (let i = 1; i < secondes + 1; i += 1) frame(1000)

      const apres = store.getState().etat
      expect(apres.bossFinal, 'combat refermé au chrono').toBeUndefined()
      expect(apres.partieTerminee).toBe(false)
      expect(apres.ascension.ascensionsEffectuees).toBe(avant.ascension.ascensionsEffectuees)
      expect(apres.bourse.pointsAscension).toBe(avant.bourse.pointsAscension)
      // Le joueur peut retenter : l'encart est revenu, l'en-tête nomme de nouveau la région.
      rendu.getByRole('region', { name: TEXTES_UI.zoneFinale.titre })
      expect(visible(rendu.getAllByTestId('nom-region')).textContent).not.toBe(TEXTES_FIN.zoneFinale.nom)
    } finally {
      rendu.unmount()
      store.arreter()
    }
  })

  it('un vrai clic « Frapper » qui achève le boss final ouvre l’écran de fin', async () => {
    await page.viewport(1440, 900)
    const { store } = creerStorePilote()
    const rendu = render(<Disposition store={store} />)
    try {
      await entrer(store, rendu)
      // Seule entorse : les PV du boss (≈ 1e104, sortie du simulateur) sont ramenés à 1. L'équilibrage
      // n'est pas l'objet de ce test ; le chemin l'est — clic réel → `appliquerClic` → `avancerBossFinal`
      // → `partieTerminee` + statistiques figées → `EcranFin`.
      act(() => store.setState({ etat: { ...store.getState().etat, bossFinal: { pvCourants: 1, timerRestantMs: 10_000 } } }))
      await userEvent.click(visible(rendu.getAllByTestId('bouton-clic')))

      expect(store.getState().etat.partieTerminee, 'partie terminée par le clic').toBe(true)
      rendu.getByRole('heading', { level: 1, name: TEXTES_FIN.ecranFin.titre })
      expect(rendu.queryAllByTestId('bouton-clic')).toHaveLength(0)
    } finally {
      rendu.unmount()
      store.arreter()
    }
  })
})
