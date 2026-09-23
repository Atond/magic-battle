// Panneau « Arbre d'Ascension » (EXG-40, vague 3) — vrai navigateur, vrai `Disposition`, vrais clics.
//
// Ce que ce fichier prouve :
//  1. le panneau n'existe pas tant que l'arbre n'est pas utile (aucune Ascension, aucun Point) ;
//  2. un clic sur « Investir » débite le coût **lu dans le domaine** (`coutRangNoeud`) en Points
//     d'Ascension, monte le rang affiché et le solde affiché — à 1440 px (colonne droite) comme à 375 px
//     (onglet Prestige) ;
//  3. refus : sans assez de Points, prérequis manquant (avec le nom du prérequis affiché), rang max,
//     lecture seule — le bouton est désactivé **et** un clic dessus ne change rien.
//
// Les Ascensions sont faites par le moteur (`ascensionner`), jamais posées à la main ; seul le solde de
// Points est ajusté ensuite, pour choisir précisément « assez » ou « pas assez ».

import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { act, render } from '@testing-library/react'

import '../../src/index.css'

import { formater } from '../../src/domain/notation.ts'
import { coutRangNoeud, noeudParId } from '../../src/domain/prestige/arbre.ts'
import { CONSTANTES } from '../../src/donnees/constantes.ts'
import { TEXTES_NOEUDS } from '../../src/donnees/arbres.ts'
import { TEXTES_UI } from '../../src/donnees/textes-ui.ts'
import { Disposition } from '../../src/components/hud/Disposition.tsx'
import { apresAscensions, creerStoreDeTest, visible } from './aide-audit.ts'

const OR_DEPART = noeudParId('ascension-or-depart', CONSTANTES)!
const AUTOCAST_FEU = noeudParId('ascension-autocast-feu', CONSTANTES)!
const AUTOCAST_GLACE = noeudParId('ascension-autocast-glace', CONSTANTES)!

/** Une Ascension faite par le moteur, puis un solde de Points et des rangs choisis par le test. */
function apresUneAscension(points: number, rangs: Readonly<Record<string, number>> = {}) {
  return apresAscensions(1, (etat) => ({
    bourse: { ...etat.bourse, pointsAscension: points },
    ascension: { ...etat.ascension, rangsArbreAscension: rangs },
  }))
}

async function rendreEtOuvrir(store: ReturnType<typeof creerStoreDeTest>, largeur: 1440 | 375) {
  await page.viewport(largeur, largeur === 1440 ? 900 : 800)
  const rendu = render(<Disposition store={store} />)
  if (largeur === 375) await userEvent.click(rendu.getByRole('tab', { name: TEXTES_UI.onglets.prestige }))
  return rendu
}

/** Le bouton d'achat du nœud, dans l'arbre réellement affiché. */
function boutonDe(getAllByTestId: (id: string) => HTMLElement[], id: string): HTMLButtonElement {
  return visible(getAllByTestId(`noeud-${id}`)).querySelector('button')!
}

describe('EXG-40 — arbre d’Ascension, visibilité', () => {
  it('nouvelle partie : aucun panneau (ni à 1440 px, ni dans l’onglet Prestige à 375 px)', async () => {
    for (const largeur of [1440, 375] as const) {
      const store = creerStoreDeTest()
      const { queryAllByRole, unmount } = await rendreEtOuvrir(store, largeur)
      try {
        expect(queryAllByRole('region', { name: TEXTES_UI.arbreAscension.titre })).toHaveLength(0)
      } finally {
        unmount()
        store.arreter()
      }
    }
  })
})

describe('EXG-40 — arbre d’Ascension, achat', () => {
  it.each([1440, 375] as const)('%i px : un clic débite le coût du domaine et monte le rang', async (largeur) => {
    const points = 50
    const store = creerStoreDeTest({ etatInitialFn: apresUneAscension(points) })
    const { getAllByTestId, getByRole, unmount } = await rendreEtOuvrir(store, largeur)
    try {
      const panneau = getByRole('region', { name: TEXTES_UI.arbreAscension.titre })
      expect(panneau.textContent).toContain(TEXTES_UI.arbreAscension.solde(formater(points)))
      for (const [id, texte] of Object.entries(TEXTES_NOEUDS).filter(([id]) => id.startsWith('ascension-'))) {
        expect(panneau.textContent, id).toContain(texte.nom)
      }

      const cout = coutRangNoeud(0, OR_DEPART, CONSTANTES)
      const bouton = boutonDe(getAllByTestId, OR_DEPART.id)
      expect(bouton.textContent).toBe(TEXTES_UI.arbreAscension.acheter(formater(cout)))
      await userEvent.click(bouton)

      expect(store.getState().etat.bourse.pointsAscension).toBe(points - cout)
      expect(store.getState().etat.ascension.rangsArbreAscension[OR_DEPART.id]).toBe(1)
      const carte = visible(getAllByTestId(`noeud-${OR_DEPART.id}`))
      expect(carte.querySelector('[data-testid="rang-noeud"]')!.textContent).toBe(
        TEXTES_UI.arbreAscension.rangSur(1, OR_DEPART.rangMax!),
      )
      expect(visible(getAllByTestId('solde-ascension')).textContent).toBe(
        TEXTES_UI.arbreAscension.solde(formater(points - cout)),
      )
      // Le prix affiché suit le rang : c'est celui du rang suivant, toujours lu dans le domaine.
      expect(boutonDe(getAllByTestId, OR_DEPART.id).textContent).toBe(
        TEXTES_UI.arbreAscension.acheter(formater(coutRangNoeud(1, OR_DEPART, CONSTANTES))),
      )
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('nœud répétable : le rang s’affiche « sans plafond »', async () => {
    const infini = CONSTANTES.noeuds.find((n) => n.arbre === 'ascension' && n.rangMax === null)!
    const store = creerStoreDeTest({ etatInitialFn: apresUneAscension(0, { [infini.id]: 7 }) })
    const { getAllByTestId, unmount } = await rendreEtOuvrir(store, 1440)
    try {
      const carte = visible(getAllByTestId(`noeud-${infini.id}`))
      expect(carte.querySelector('[data-testid="rang-noeud"]')!.textContent).toBe(TEXTES_UI.arbreAscension.rangSansFin(7))
    } finally {
      unmount()
      store.arreter()
    }
  })
})

describe('EXG-40 — arbre d’Ascension, refus', () => {
  it('pas assez de Points : bouton désactivé, un clic ne change rien', async () => {
    const cout = coutRangNoeud(0, OR_DEPART, CONSTANTES)
    const store = creerStoreDeTest({ etatInitialFn: apresUneAscension(cout - 1) })
    const { getAllByTestId, unmount } = await rendreEtOuvrir(store, 1440)
    try {
      const avant = store.getState().etat
      const bouton = boutonDe(getAllByTestId, OR_DEPART.id)
      expect(bouton.disabled, 'bouton d’achat sans assez de Points').toBe(true)
      await userEvent.click(bouton, { force: true })
      expect(store.getState().etat).toBe(avant)
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('prérequis manquant : bouton désactivé, nom du prérequis affiché ; acheté, la suite s’ouvre', async () => {
    const store = creerStoreDeTest({ etatInitialFn: apresUneAscension(1000) })
    const { getAllByTestId, unmount } = await rendreEtOuvrir(store, 1440)
    try {
      const avant = store.getState().etat
      const carteGlace = visible(getAllByTestId(`noeud-${AUTOCAST_GLACE.id}`))
      expect(carteGlace.textContent).toContain(TEXTES_UI.arbreAscension.prerequis(TEXTES_NOEUDS[AUTOCAST_FEU.id]!.nom))
      const glace = boutonDe(getAllByTestId, AUTOCAST_GLACE.id)
      expect(glace.disabled, 'bouton d’un nœud dont le prérequis manque').toBe(true)
      expect(glace.textContent).toBe(TEXTES_UI.arbreAscension.verrouille)
      await userEvent.click(glace, { force: true })
      expect(store.getState().etat).toBe(avant)

      await userEvent.click(boutonDe(getAllByTestId, AUTOCAST_FEU.id))
      expect(boutonDe(getAllByTestId, AUTOCAST_GLACE.id).disabled, 'prérequis acheté, nœud suivant ouvert').toBe(false)
      // Rang max (1) atteint sur le nœud acheté : bouton fermé, libellé explicite.
      const feu = boutonDe(getAllByTestId, AUTOCAST_FEU.id)
      expect(feu.disabled, 'nœud à son rang max').toBe(true)
      expect(feu.textContent).toBe(TEXTES_UI.arbreAscension.rangMax)
    } finally {
      unmount()
      store.arreter()
    }
  })

  it('lecture seule : tous les boutons de l’arbre désactivés, un clic ne change rien', async () => {
    const store = creerStoreDeTest({ etatInitialFn: apresUneAscension(1000) })
    const { getByRole, getAllByTestId, unmount } = await rendreEtOuvrir(store, 1440)
    try {
      // Même procédé que l'audit du bandeau : l'affichage lit `lectureSeule` ; la garde de l'action
      // elle-même (onglet secondaire réel) est prouvée dans `tests/state/actions-ascension-fin.test.ts`.
      act(() => store.setState({ lectureSeule: true, motifLectureSeule: 'ongletSecondaire' }))
      const panneau = getByRole('region', { name: TEXTES_UI.arbreAscension.titre })
      const boutons = [...panneau.querySelectorAll('button')]
      expect(boutons.length).toBe(CONSTANTES.noeuds.filter((n) => n.arbre === 'ascension').length)
      for (const b of boutons) expect(b.disabled, b.textContent ?? '').toBe(true)
      const avant = store.getState().etat
      await userEvent.click(boutonDe(getAllByTestId, OR_DEPART.id), { force: true })
      expect(store.getState().etat).toBe(avant)
    } finally {
      unmount()
      store.arreter()
    }
  })
})
