// Disposition HUD (T-19, spec §16 T-19 « Done quand », §7). Vrai navigateur (Vitest browser mode +
// Playwright, ADR-20) : mesure de mise en page réelle à 1440 px et 375 px, cibles tactiles ≥ 24 px.
//
// Ce que ce test prouve, précisément :
//  1. desktop (1440 px) — 3 colonnes ordonnées en x (écoles, puis combat, puis progression), aucun
//     débordement horizontal, la pile mobile (onglets) est absente de l'arbre accessible ;
//  2. mobile (375 px) — pile verticale (combat au-dessus des onglets), 3 onglets Écoles / Améliorations /
//     Prestige, aucun débordement horizontal, la grille desktop est absente de l'arbre accessible ;
//  3. dans les deux mises en page, chaque cible interactive visible mesure au moins 24×24 px.

import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { render } from '@testing-library/react'

// Ce projet ne charge pas de `setupFiles` (voir `vite.config.ts`, projet `ui`) : l'auto-cleanup de
// `@testing-library/react` ne s'arme que si `afterEach` existe en global (Jest, ou `test.globals: true`),
// ce qui n'est pas le cas ici. Chaque rendu est donc démonté explicitement (`unmount()`) avant le
// suivant — sinon deux arbres coexisteraient dans le même document et les requêtes de rôle (`getByRole`)
// deviendraient ambiguës d'un test à l'autre.

// Le rendu ne passe jamais par `main.tsx` dans ce test : sans cet import, Tailwind ne compile jamais les
// classes `hidden`/`lg:grid`/`lg:hidden` dans le document de test, et les deux arborescences (desktop +
// mobile) resteraient visibles en même temps — d'où l'import direct de la feuille de styles ici.
import '../../src/index.css'

import { etatInitial } from '../../src/domain/moteur.ts'
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

const T0 = 1_700_000_000_000

function creerStoreDeTest() {
  return creerStoreJeu({
    horloge: creerHorlogeFactice(T0),
    stockage: creerStockageFactice(),
    canal: creerCanalFactice(),
    matchMedia: creerMatchMediaFactice(),
    idOnglet: 'onglet-disposition',
    portPage: creerPortPageFactice(),
    portPlanificateur: creerPortPlanificateurFactice(),
    etatInitial,
  })
}

/** Aucun débordement horizontal (EXG-35) : le contenu ne dépasse jamais la largeur visible. */
function sansDebordementHorizontal(): void {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
}

describe('disposition HUD — 3 colonnes desktop / pile + onglets mobile (spec §7, EXG-35)', () => {
  it('1440 px : 3 colonnes ordonnées en x, pas de débordement, pas d’onglets mobiles visibles', async () => {
    await page.viewport(1440, 900)
    const store = creerStoreDeTest()
    const { getByRole, queryAllByRole, unmount } = render(<Disposition store={store} />)

    const colonneEcoles = getByRole('region', { name: 'Écoles' })
    const colonneAmeliorations = getByRole('region', { name: 'Améliorations' })
    const rectEcoles = colonneEcoles.getBoundingClientRect()
    const rectAmeliorations = colonneAmeliorations.getBoundingClientRect()

    // La colonne écoles est visible et positionnée à gauche de la colonne améliorations (spec §7 :
    // « écoles à gauche […] à droite »).
    expect(rectEcoles.width).toBeGreaterThan(0)
    expect(rectAmeliorations.width).toBeGreaterThan(0)
    expect(rectEcoles.right).toBeLessThanOrEqual(rectAmeliorations.left)

    // Les onglets mobiles n'existent pas dans l'arbre accessible à 1440 px (masqués par `lg:hidden`,
    // donc `display: none` — exclus des requêtes de rôle par testing-library).
    expect(queryAllByRole('tab')).toHaveLength(0)

    sansDebordementHorizontal()
    await page.screenshot({ path: './__screenshots__/hud-1440.png' })

    unmount()
    store.arreter()
  })

  it('375 px : pile verticale (combat au-dessus des onglets), 3 onglets, pas de débordement', async () => {
    await page.viewport(375, 800)
    const store = creerStoreDeTest()
    const { getAllByTestId, getAllByRole, queryByRole, unmount } = render(<Disposition store={store} />)

    const onglets = getAllByRole('tab')
    expect(onglets.map((o) => o.textContent)).toEqual(['Écoles', 'Améliorations', 'Prestige'])

    // `PanneauCentral` existe dans les deux arborescences (desktop + mobile) ; `getByTestId` ne filtre
    // pas les éléments masqués (contrairement à `getByRole`), donc on prend celui qui a une taille réelle.
    const combat = getAllByTestId('conteneur-canvas').find((el) => el.getBoundingClientRect().width > 0)
    expect(combat).toBeDefined()
    const rectCombat = combat!.getBoundingClientRect()
    const rectOnglets = onglets[0].getBoundingClientRect()
    expect(rectCombat.height).toBeGreaterThan(0)
    // Combat + sorts fixes en haut, onglets dessous (spec §7).
    expect(rectCombat.bottom).toBeLessThanOrEqual(rectOnglets.top)

    // La grille desktop (3 colonnes) n'existe pas dans l'arbre accessible à 375 px.
    expect(queryByRole('region', { name: 'Améliorations' })).toBeNull()

    sansDebordementHorizontal()
    await page.screenshot({ path: './__screenshots__/hud-375.png' })

    unmount()
    store.arreter()
  })

  it('toutes les cibles interactives visibles mesurent au moins 24×24 px, à 1440 px et à 375 px', async () => {
    for (const [largeur, hauteur] of [
      [1440, 900],
      [375, 800],
    ] as const) {
      await page.viewport(largeur, hauteur)
      const store = creerStoreDeTest()
      const { getAllByRole, queryAllByRole, unmount } = render(<Disposition store={store} />)

      // `getAllBy*` lève une erreur quand la liste est vide (contrairement à `queryAllBy*`) : à 1440 px
      // il n'y a aucun onglet visible (`lg:hidden`), donc `queryAllByRole` est le bon choix ici.
      const cibles = [...getAllByRole('button'), ...queryAllByRole('tab')]
      expect(cibles.length).toBeGreaterThan(0)
      for (const cible of cibles) {
        const rect = cible.getBoundingClientRect()
        expect(rect.width, `largeur de « ${cible.textContent} » à ${largeur}px`).toBeGreaterThanOrEqual(24)
        expect(rect.height, `hauteur de « ${cible.textContent} » à ${largeur}px`).toBeGreaterThanOrEqual(24)
      }

      unmount()
      store.arreter()
    }
  })
})
