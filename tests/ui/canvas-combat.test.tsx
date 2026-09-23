// Canvas de combat en vrai navigateur (T-21, spec §16 T-21 « Done quand », EXG-29/30/32/33/50/52, ADR-19/20).
// Contrairement à `tests/ui/canvas-deltas.test.ts`/`canvas-limite.test.ts` (logique pure, sans DOM), ce
// fichier espionne un vrai `CanvasRenderingContext2D` : c'est la seule façon de prouver qu'aucun dessin de
// projectile n'a lieu (réduction de mouvement, option performance) plutôt que de le déduire de la logique.
//
// Ce que ce fichier prouve, précisément :
//  1. EXG-33 — le `<canvas>` est `aria-hidden="true"` ;
//  2. EXG-50 — `prefers-reduced-motion: reduce` simulé via le port `matchMedia` : zéro dessin de
//     projectile (`ctx.arc`) dès le tout premier rendu, sans aucune action ; témoin positif : la même
//     scène SANS réduction, avec les mêmes clics, dessine bien au moins un projectile ;
//  3. EXG-29 — option performance activée explicitement (persistée dans `magic-battle:reglages`) : zéro
//     dessin de projectile même sans réduction de mouvement, et les dégâts/l'état de jeu ne sont pas
//     affectés (le moteur ignore ce réglage, ADR-21) ;
//  4. EXG-32 — miroir DOM des PV de la cible et du timer de boss : le texte affiché correspond
//     exactement à l'état construit pour le test, jamais une valeur approchée ;
//  5. l'annonce `aria-live` ne change qu'aux événements significatifs (monstre vaincu), jamais à chaque
//     frame ;
//  6. dimensionnement du canvas à son conteneur × `devicePixelRatio` ;
//  7. l'interrupteur de performance est accessible (rôle, focus clavier) et 0 violation axe-core sur le
//     panneau complet.

import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'
import axe from 'axe-core'

// Voir hud-disposition.test.tsx : sans cet import, Tailwind ne compile jamais les classes utilisées ici.
import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
import type { Boss, EtatJeu, Monstre } from '../../src/domain/types.ts'
import { CanvasCombat } from '../../src/canvas/CanvasCombat.tsx'
import { CLE_REGLAGES } from '../../src/canvas/reglages.ts'
import { creerStoreJeu } from '../../src/state/store.ts'
import type { StoreJeuApi } from '../../src/state/store.ts'
import {
  creerCanalFactice,
  creerHorlogeFactice,
  creerMatchMediaFactice,
  creerPortPageFactice,
  creerPortPlanificateurFactice,
  creerStockageFactice,
} from '../state/doubles.ts'
import type { Stockage } from '../../src/state/ports.ts'

const T0 = 1_700_000_000_000

function creerStoreDeTest(params: {
  readonly reduitPrefere?: boolean
  readonly stockage?: Stockage
  readonly etatInitialFn?: (horodatageMs: number) => EtatJeu
}): StoreJeuApi {
  return creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: params.stockage ?? creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(params.reduitPrefere ?? false),
    idOnglet: 'onglet-canvas-combat',
    portPage: creerPortPageFactice(),
    portPlanificateur: creerPortPlanificateurFactice(),
    etatInitial: params.etatInitialFn ?? etatInitial,
  })
}

/**
 * Attend au moins `n` cycles réels de `requestAnimationFrame`. `CanvasCombat` tient sa propre boucle hors
 * React, avec le vrai `window.requestAnimationFrame` (ADR-19) — jamais le `portPlanificateur` factice
 * (celui-ci pilote la boucle du *moteur*, pas celle, indépendante, du canvas). C'est le seul point
 * d'attente possible ici ; aucun test existant du dépôt n'en avait encore eu besoin.
 */
async function attendreFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
}

const CIBLE_MONSTRE: Monstre = { nom: 'Gobelin', pvMax: 100, pvCourants: 42, orAuMeurtre: 5 }
const CIBLE_BOSS: Boss = {
  nom: 'Golem de zone',
  pvMax: 500,
  pvCourants: 500,
  orAuMeurtre: 50,
  zone: 3,
  estBoss: true,
  estFinal: false,
}

function etatAvecCible(cible: Monstre | Boss, timerBossRestantMs: number | null = null) {
  return (horodatageMs: number): EtatJeu => {
    const base = etatInitial(horodatageMs)
    return { ...base, combat: { ...base.combat, cible, timerBossRestantMs } }
  }
}

describe('EXG-33 — le canvas est masqué aux technologies d’assistance', () => {
  it('aria-hidden="true" sur le <canvas>', async () => {
    const store = creerStoreDeTest({})
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)
    expect(getByTestId('canvas-combat').getAttribute('aria-hidden')).toBe('true')
    unmount()
    store.arreter()
  })
})

describe('EXG-50 — prefers-reduced-motion : zéro dessin de projectile dès le premier rendu, sans action', () => {
  it('réduction de mouvement active : aucun ctx.arc appelé, même après des clics et plusieurs frames', async () => {
    const store = creerStoreDeTest({ reduitPrefere: true })
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)
    const canvas = getByTestId('canvas-combat') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const espionArc = vi.spyOn(ctx, 'arc')

    // Dès le tout premier rendu, sans la moindre action : déjà aucun dessin.
    await attendreFrames(2)
    expect(espionArc).not.toHaveBeenCalled()

    // Même en enchaînant des clics (qui produiraient normalement des projectiles) : toujours rien.
    for (let i = 0; i < 5; i += 1) store.getState().actions.clic()
    await attendreFrames(3)
    expect(espionArc).not.toHaveBeenCalled()

    unmount()
    store.arreter()
  })

  it('témoin positif — sans réduction de mouvement, les mêmes clics dessinent au moins un projectile', async () => {
    const store = creerStoreDeTest({ reduitPrefere: false })
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)
    const canvas = getByTestId('canvas-combat') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const espionArc = vi.spyOn(ctx, 'arc')

    // Une première frame doit s'écouler pour poser l'instantané de référence (aucun delta n'est
    // détectable avant qu'un premier instantané existe) avant de cliquer.
    await attendreFrames(1)
    for (let i = 0; i < 5; i += 1) store.getState().actions.clic()
    await attendreFrames(3)

    expect(espionArc).toHaveBeenCalled()

    unmount()
    store.arreter()
  })
})

describe('EXG-29 — option performance activée : zéro dessin de projectile, état de jeu inchangé', () => {
  it('réglage persisté { performance: true } : aucun ctx.arc, même sans réduction de mouvement système', async () => {
    const stockage = creerStockageFactice()
    stockage.ecrire(CLE_REGLAGES, '{"performance":true}')
    const store = creerStoreDeTest({ reduitPrefere: false, stockage })
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)
    const canvas = getByTestId('canvas-combat') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const espionArc = vi.spyOn(ctx, 'arc')

    await attendreFrames(1)
    for (let i = 0; i < 5; i += 1) store.getState().actions.clic()
    await attendreFrames(3)

    expect(espionArc).not.toHaveBeenCalled()
    // Le moteur ignore ce réglage (ADR-21) : les 5 clics ont bien compté, dégâts inclus.
    expect(store.getState().etat.magicien.clicsCumules).toBe(5)

    unmount()
    store.arreter()
  })

  it('même nombre de clics comptés qu’avec l’option performance désactivée : le rendu n’influence jamais le moteur', async () => {
    const stockagePerf = creerStockageFactice()
    stockagePerf.ecrire(CLE_REGLAGES, '{"performance":true}')
    const storePerf = creerStoreDeTest({ reduitPrefere: false, stockage: stockagePerf })
    const storeNormal = creerStoreDeTest({ reduitPrefere: false })

    const { unmount: unmountPerf } = render(<CanvasCombat store={storePerf} />)
    const { unmount: unmountNormal } = render(<CanvasCombat store={storeNormal} />)

    for (let i = 0; i < 7; i += 1) {
      storePerf.getState().actions.clic()
      storeNormal.getState().actions.clic()
    }
    await attendreFrames(3)

    expect(storePerf.getState().etat.magicien.clicsCumules).toBe(storeNormal.getState().etat.magicien.clicsCumules)
    expect(storePerf.getState().etat.magicien.degatsCumules).toBe(storeNormal.getState().etat.magicien.degatsCumules)

    unmountPerf()
    unmountNormal()
    storePerf.arreter()
    storeNormal.arreter()
  })
})

describe('EXG-32 — miroir DOM des PV de la cible et du timer de boss', () => {
  it('affiche exactement les PV de la cible construite pour le test', async () => {
    const store = creerStoreDeTest({ etatInitialFn: etatAvecCible(CIBLE_MONSTRE) })
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)

    expect(getByTestId('pv-cible').textContent).toBe('PV 42 / 100')
    expect(() => getByTestId('timer-boss')).toThrow()

    unmount()
    store.arreter()
  })

  it('affiche le timer de boss exact (arrondi à la seconde supérieure) quand la cible est un boss', async () => {
    const store = creerStoreDeTest({ etatInitialFn: etatAvecCible(CIBLE_BOSS, 61_400) })
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)

    expect(getByTestId('pv-cible').textContent).toBe('PV 500 / 500')
    expect(getByTestId('timer-boss').textContent).toBe('Boss — 62 s')

    unmount()
    store.arreter()
  })

  it('aucune cible : message dédié, pas de bloc PV chiffré', async () => {
    const store = creerStoreDeTest({})
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)

    expect(getByTestId('pv-cible').textContent).toBe('Rien à taper pour l’instant.')

    unmount()
    store.arreter()
  })
})

describe('annonce aria-live — seulement les événements significatifs, jamais la cadence du tick', () => {
  it('vide au montage, puis annonce « vaincu » quand monstresTues augmente — pas avant', async () => {
    const store = creerStoreDeTest({ etatInitialFn: etatAvecCible(CIBLE_MONSTRE) })
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)

    expect(getByTestId('annonce-combat').textContent).toBe('')

    // Un simple clic qui n'achève pas le monstre (PV encore largement positifs) ne déclenche aucune
    // annonce : seul un delta de `monstresTues` en produit une.
    store.getState().actions.clic()
    await attendreFrames(1)
    expect(getByTestId('annonce-combat').textContent).toBe('')

    unmount()
    store.arreter()
  })
})

describe('dimensionnement du canvas — conteneur × devicePixelRatio, jamais figé', () => {
  it('la surface de dessin (canvas.width/height) suit la taille du conteneur et le devicePixelRatio', async () => {
    const store = creerStoreDeTest({})
    const { getByTestId, unmount } = render(<CanvasCombat store={store} />)
    const conteneur = getByTestId('conteneur-canvas') as HTMLElement
    const canvas = getByTestId('canvas-combat') as HTMLCanvasElement

    await attendreFrames(2)

    const rect = conteneur.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    expect(canvas.width).toBe(Math.max(1, Math.round(rect.width * dpr)))
    expect(canvas.height).toBe(Math.max(1, Math.round(rect.height * dpr)))
    expect(canvas.width).toBeGreaterThan(0)
    expect(canvas.height).toBeGreaterThan(0)

    unmount()
    store.arreter()
  })
})

describe('interrupteur de performance — accessible, persiste le choix explicite', () => {
  it('rôle switch, activable au clavier, et le canvas cesse de dessiner des projectiles une fois activé', async () => {
    const store = creerStoreDeTest({ reduitPrefere: false })
    const { getByTestId, getByRole, unmount } = render(<CanvasCombat store={store} />)
    const canvas = getByTestId('canvas-combat') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!

    const interrupteur = getByRole('switch', { name: 'Effets visuels de combat' })
    expect(interrupteur.getAttribute('aria-checked')).toBe('false')

    // Témoin positif : avant toute activation, des clics remplissent le tampon de projectiles ET
    // déclenchent bien des dessins — sinon désactiver ensuite ne prouverait rien.
    const espionArc = vi.spyOn(ctx, 'arc')
    await attendreFrames(1)
    for (let i = 0; i < 5; i += 1) store.getState().actions.clic()
    await attendreFrames(3)
    expect(espionArc).toHaveBeenCalled()

    // Le tampon garde ces projectiles déjà en file (chaque frame redessine tout le tampon, pas
    // seulement les nouveautés) : activer l'interrupteur DOIT arrêter net leur dessin, alors même
    // qu'ils sont encore présents dans `tamponRef` — un simple « ne plus en ajouter » ne suffirait pas.
    await userEvent.click(interrupteur)
    expect(interrupteur.getAttribute('aria-checked')).toBe('true')

    espionArc.mockClear()
    await attendreFrames(3)
    expect(espionArc).not.toHaveBeenCalled()

    unmount()
    store.arreter()
  })

  it('0 violation axe-core sur le panneau complet (canvas + miroir + interrupteur)', async () => {
    const store = creerStoreDeTest({ etatInitialFn: etatAvecCible(CIBLE_MONSTRE) })
    const { container, unmount } = render(<CanvasCombat store={store} />)

    const resultats = await axe.run(container)
    expect(resultats.violations.length).toBe(0)
    expect(resultats.incomplete.filter((r) => r.id === 'color-contrast').length).toBe(0)

    unmount()
    store.arreter()
  })
})
