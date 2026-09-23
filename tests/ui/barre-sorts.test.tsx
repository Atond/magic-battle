// Barre de sorts actifs (T-20, spec §16 T-20 « Done quand », EXG-11 à EXG-14, EXG-34, EXG-51). Vrai
// navigateur (Vitest browser mode + Playwright, ADR-20) : `userEvent` pour de vrais événements clavier
// et souris — un `fireEvent` synthétique ne prouverait pas que le focus/la cible réels sont respectés.
//
// Ce que ce fichier prouve, précisément :
//  1. touche « 1 » (sort déjà débloqué au départ) déclenche le sort et arme son cooldown ;
//  2. touche « 6 » ne fait rien avant la 1re Ascension, puis déclenche le sort de Lumière après — l'état
//     post-Ascension est construit en rejouant `ascensionner`/`acheterNiveaux` du moteur, jamais en
//     posant `sixiemeEcoleDebloquee`/`debloquee` à la main ;
//  3. touche « 2 » déclenche le 2e sort hors cooldown, ne fait strictement rien pendant le cooldown
//     (aucune ressource consommée, aucun état changé) ;
//  4. 10 clics sur la zone de clic dédiée en 1 s = 10 applications de dégâts (EXG-11) ;
//  5. chaque cible de la barre de sorts mesure au moins 44×44 px à 375 px (EXG-51) ;
//  6. le cooldown restant est affiché en texte (EXG-12) ;
//  7. une touche est ignorée quand le focus est dans un champ de saisie, ou sous `[aria-modal="true"]`
//     (mécanisme posé pour T-23b).

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from '@testing-library/react'

// Voir hud-disposition.test.tsx : sans cet import, Tailwind ne compile jamais les classes utilisées ici.
import '../../src/index.css'

import { acheterNiveaux } from '../../src/domain/ecoles/index.ts'
import { ascensionner } from '../../src/domain/ascension/index.ts'
import { etatInitial } from '../../src/domain/moteur.ts'
import type { EtatJeu } from '../../src/domain/types.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import {
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
  return creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-barre-sorts',
    portPage: creerPortPageFactice(),
    portPlanificateur: creerPortPlanificateurFactice(),
    etatInitial: etatInitialFn,
  })
}

/** École de Glace (2e sort) déjà débloquée : sans ça la touche « 2 » serait refusée comme verrouillée,
 *  ce qui ne prouverait rien sur le cooldown (précondition, pas la mécanique testée par EXG-12). */
function etatAvecGlaceDebloquee(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  return { ...base, ecoles: { ...base.ecoles, glace: { niveau: 5, debloquee: true, revelee: true } } }
}

/**
 * État post-1re-Ascension avec le sort de Lumière débloqué, construit **via le moteur** (spec T-20) :
 * on pose seulement la précondition numérique (prestiges du cycle au seuil), puis on rejoue
 * `ascensionner` (EXG-20/EXG-41) et `acheterNiveaux` (EXG-7) — aucun drapeau `ascension.*`/`ecoles.*`
 * n'est écrit à la main.
 */
function etatPostAscensionAvecLumiere(horodatageMs: number): EtatJeu {
  const base = etatInitial(horodatageMs)
  const auSeuilDAscension: EtatJeu = {
    ...base,
    prestige: { ...base.prestige, prestigesDuCycle: CONSTANTES.ascension.prestigesParAscension },
  }
  const resultatAscension = ascensionner(auSeuilDAscension, CONSTANTES)
  if (!resultatAscension.accepte) {
    throw new Error('ascension refusée dans le test : vérifier prestigesParAscension dans CONSTANTES')
  }
  const genereux: EtatJeu = {
    ...resultatAscension.etat,
    bourse: { ...resultatAscension.etat.bourse, or: 1e12 },
  }
  const resultatAchat = acheterNiveaux(genereux, 'lumiere', 1, CONSTANTES)
  if (!resultatAchat.accepte) {
    throw new Error('achat de Lumière refusé dans le test : vérifier ecoleAccessible après Ascension')
  }
  return resultatAchat.etat
}

describe('EXG-13/EXG-34 — raccourcis clavier 1-6 (T-20)', () => {
  it('« 1 » déclenche le sort déjà débloqué au départ (arme son cooldown)', async () => {
    const store = creerStoreDeTest()
    const { unmount } = render(<Disposition store={store} />)

    expect(store.getState().etat.sorts['sort-feu']).toBeUndefined()
    await userEvent.keyboard('1')
    expect(store.getState().etat.sorts['sort-feu']?.cooldownRestantMs).toBeGreaterThan(0)

    unmount()
    store.arreter()
  })

  it('une frappe ne déclenche le sort qu’une seule fois (un seul écouteur global, pas un par panneau)', async () => {
    // `PanneauCentral` est monté deux fois en parallèle (desktop caché + mobile visible, voir
    // `Disposition.tsx`) : si `useRaccourcisSorts` était appelé depuis ce composant plutôt que depuis
    // `Disposition`, une frappe déclencherait le sort deux fois. Le cooldown du moteur masquerait ce
    // doublon sur `cooldownRestantMs` (idempotent une fois armé) — on compte donc les appels directement
    // plutôt que d'inférer le nombre de déclenchements depuis l'état.
    const store = creerStoreDeTest()
    const original = store.getState().actions.lancerSort
    let appels = 0
    store.setState({
      actions: {
        ...store.getState().actions,
        lancerSort: (idSort: string) => {
          appels += 1
          original(idSort)
        },
      },
    })
    const { unmount } = render(<Disposition store={store} />)

    await userEvent.keyboard('1')
    expect(appels).toBe(1)

    unmount()
    store.arreter()
  })

  it('« 6 » ne fait rien avant la 1re Ascension, déclenche le sort de Lumière après', async () => {
    // Avant Ascension : aucun effet, quand bien même l'école de Lumière serait un jour débloquée.
    const storeAvant = creerStoreDeTest()
    const { unmount: unmountAvant } = render(<Disposition store={storeAvant} />)
    await userEvent.keyboard('6')
    expect(storeAvant.getState().etat.sorts['sort-lumiere']).toBeUndefined()
    unmountAvant()
    storeAvant.arreter()

    // Après Ascension (et achat du niveau 1 de Lumière) : la même touche fonctionne.
    const storeApres = creerStoreDeTest(etatPostAscensionAvecLumiere)
    const { unmount: unmountApres } = render(<Disposition store={storeApres} />)
    expect(storeApres.getState().etat.sorts['sort-lumiere']).toBeUndefined()
    await userEvent.keyboard('6')
    expect(storeApres.getState().etat.sorts['sort-lumiere']?.cooldownRestantMs).toBeGreaterThan(0)
    unmountApres()
    storeApres.arreter()
  })

  it('« 2 » déclenche le 2e sort hors cooldown, ne fait rien pendant le cooldown (aucune ressource consommée)', async () => {
    const store = creerStoreDeTest(etatAvecGlaceDebloquee)
    const { unmount } = render(<Disposition store={store} />)

    await userEvent.keyboard('2')
    const apresPremierLancer = store.getState().etat
    expect(apresPremierLancer.sorts['sort-glace']?.cooldownRestantMs).toBeGreaterThan(0)
    expect(apresPremierLancer.magicien.degatsCumules).toBeGreaterThan(0)

    // Toujours en cooldown : la touche ne doit strictement rien changer — même référence d'état côté
    // sorts/bourse/magicien, pas seulement « pas d'erreur ».
    await userEvent.keyboard('2')
    const apresSecondAppui = store.getState().etat
    expect(apresSecondAppui.sorts['sort-glace']).toEqual(apresPremierLancer.sorts['sort-glace'])
    expect(apresSecondAppui.magicien.degatsCumules).toBe(apresPremierLancer.magicien.degatsCumules)
    expect(apresSecondAppui.bourse.or).toBe(apresPremierLancer.bourse.or)

    unmount()
    store.arreter()
  })

  it('une touche de sort verrouillé est ignorée et l’état « verrouillé » est visible (icône + libellé)', async () => {
    const store = creerStoreDeTest()
    const { getAllByTestId, unmount } = render(<Disposition store={store} />)

    const cartes6 = getAllByTestId('sort-6').filter((el) => el.getBoundingClientRect().width > 0)
    expect(cartes6.length).toBeGreaterThan(0)
    for (const carte of cartes6) {
      expect(carte.tagName).not.toBe('BUTTON')
      expect(carte.getAttribute('aria-label')).toContain('verrouillé')
      expect(carte.textContent).toContain('🔒')
    }

    await userEvent.keyboard('6')
    expect(store.getState().etat.sorts['sort-lumiere']).toBeUndefined()

    unmount()
    store.arreter()
  })

  it('une touche de sort est ignorée dans un champ de saisie', async () => {
    const store = creerStoreDeTest()
    const { getByTestId, unmount } = render(
      <>
        <input data-testid="champ-texte" aria-label="Champ de test" />
        <Disposition store={store} />
      </>,
    )

    await userEvent.click(getByTestId('champ-texte'))
    await userEvent.keyboard('1')

    expect(store.getState().etat.sorts['sort-feu']).toBeUndefined()

    unmount()
    store.arreter()
  })

  it('une touche de sort est ignorée sous une modale ([aria-modal="true"] ouverte)', async () => {
    const store = creerStoreDeTest()
    const { unmount } = render(
      <>
        <div aria-modal="true" role="dialog">
          modale de test
        </div>
        <Disposition store={store} />
      </>,
    )

    await userEvent.keyboard('1')

    expect(store.getState().etat.sorts['sort-feu']).toBeUndefined()

    unmount()
    store.arreter()
  })
})

describe('EXG-11 — zone de clic dédiée (T-20)', () => {
  it('10 clics en 1 s produisent 10 applications de dégâts', async () => {
    const store = creerStoreDeTest()
    const { getAllByTestId, unmount } = render(<Disposition store={store} />)

    const bouton = getAllByTestId('bouton-clic').find((el) => el.getBoundingClientRect().width > 0)
    expect(bouton).toBeDefined()

    for (let i = 0; i < 10; i += 1) {
      await userEvent.click(bouton!)
    }

    expect(store.getState().etat.magicien.clicsCumules).toBe(10)

    unmount()
    store.arreter()
  })
})

describe('EXG-51 — cibles tactiles de la barre de sorts ≥ 44×44 px à 375 px', () => {
  it('chaque cellule de la barre de sorts (débloquée ou verrouillée) mesure au moins 44×44 px', async () => {
    await page.viewport(375, 800)
    const store = creerStoreDeTest()
    const { getAllByRole, unmount } = render(<Disposition store={store} />)

    const barre = getAllByRole('list', { name: 'Sorts actifs' }).find(
      (el) => el.getBoundingClientRect().width > 0,
    )
    expect(barre).toBeDefined()
    const cibles = [...barre!.querySelectorAll('[data-testid^="sort-"]')]
    expect(cibles.length).toBe(6)
    for (const cible of cibles) {
      const rect = cible.getBoundingClientRect()
      expect(rect.width, `largeur de ${cible.getAttribute('data-testid')}`).toBeGreaterThanOrEqual(44)
      expect(rect.height, `hauteur de ${cible.getAttribute('data-testid')}`).toBeGreaterThanOrEqual(44)
    }

    unmount()
    store.arreter()
  })
})

describe('EXG-12 — cooldown restant affiché en texte', () => {
  it('après déclenchement, le temps restant apparaît en texte sur la cellule du sort', async () => {
    const store = creerStoreDeTest()
    const { getAllByTestId, unmount } = render(<Disposition store={store} />)

    await userEvent.keyboard('1')

    const cartes = getAllByTestId('sort-1').filter((el) => el.getBoundingClientRect().width > 0)
    expect(cartes.length).toBeGreaterThan(0)
    const cooldownMsAttendu = CONSTANTES.sorts.find((s) => s.id === 'sort-feu')!.cooldownMs
    const secondesAttendues = Math.ceil(cooldownMsAttendu / 1000)
    for (const carte of cartes) {
      expect(carte.textContent).toContain(`${secondesAttendues}`)
      expect(carte.getAttribute('aria-label')).toContain(`${secondesAttendues}`)
    }

    unmount()
    store.arreter()
  })
})
